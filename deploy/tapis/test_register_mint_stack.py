"""Offline regression checks for database data-loss boundaries."""

import os
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

import register_mint_stack as deploy


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {}, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.spec = deploy.build_specs("mintproject", "sha-test", "https://portals.tapis.io")["postgres"]

    def test_database_uses_postgis_and_pgdata_within_persistent_mount(self):
        self.assertEqual(self.spec["image"], "ghcr.io/mintproject/postgres-pgvector:develop")
        self.assertEqual(self.spec["template"], "postgres:16postgis3.5")
        data = self.spec["environment_variables"]["PGDATA"]
        mount, source = next(iter(self.spec["volume_mounts"].items()))
        self.assertTrue(data.startswith(mount + "/"))
        self.assertEqual(source["type"], "tapisvolume")
        self.assertEqual(source["source_id"], "mintdevpostgresdata")

    def test_existing_storage_can_be_reused(self):
        deploy.check_postgres_storage(self.spec, recreate=False)

    def test_known_plain_postgis_storage_can_transition_to_pgvector(self):
        legacy = {**self.spec, "image": "postgis/postgis:16-3.5"}
        deploy.check_postgres_storage(legacy, recreate=False)

    def test_sdk_objects_are_supported(self):
        def obj(value):
            return SimpleNamespace(**{k: obj(v) for k, v in value.items()}) if isinstance(value, dict) else value
        deploy.check_postgres_storage(obj(self.spec), recreate=False)

    def test_ephemeral_or_different_storage_fails_before_update_or_delete(self):
        for change in [
            {"volume_mounts": {}},
            {"volume_mounts": None},
            {"environment_variables": {}},
            {"image": "postgres:16"},
            {"volume_mounts": {deploy.POSTGRES_MOUNT: {"type": "tapisvolume", "source_id": "other", "sub_path": ""}}},
        ]:
            with self.subTest(change=change):
                t = Mock()
                t.pods.get_pod.return_value = {**self.spec, **change}
                with self.assertRaises(RuntimeError):
                    deploy.upsert_pod(t, self.spec, recreate=False, start=True, restart=True)
                t.pods.update_pod.assert_not_called()
                t.pods.delete_pod.assert_not_called()

    def test_recreate_cannot_bypass_postgres_guard(self):
        t = Mock()
        t.pods.get_pod.return_value = self.spec
        with self.assertRaises(RuntimeError):
            deploy.upsert_pod(t, self.spec, recreate=True, start=True, restart=True)
        t.pods.delete_pod.assert_not_called()

    def test_nested_mount_cannot_hide_persistent_pgdata(self):
        self.spec["volume_mounts"][deploy.POSTGRES_DATA] = {"type": "ephemeral"}
        with self.assertRaises(RuntimeError):
            deploy.check_postgres_storage(self.spec, recreate=False)

    def test_readonly_database_volume_is_rejected(self):
        self.spec["volume_mounts"][deploy.POSTGRES_MOUNT]["read_only"] = True
        with self.assertRaises(RuntimeError):
            deploy.check_postgres_storage(self.spec, recreate=False)

    def test_only_404_is_missing(self):
        for code in (400, 401, 403, 500, None):
            error = Exception("do not expose credentials")
            error.response = SimpleNamespace(status_code=code)
            with self.subTest(code=code), self.assertRaises(RuntimeError) as ctx:
                deploy._get_or_missing(Mock(side_effect=error))
            self.assertNotIn("credentials", str(ctx.exception))
        error.response.status_code = 404
        self.assertIsNone(deploy._get_or_missing(Mock(side_effect=error)))

    def test_volume_is_reused_without_create_or_delete(self):
        t = Mock()
        t.pods.get_volume.return_value = {"status": "AVAILABLE"}
        deploy.ensure_postgres_volume(t)
        t.pods.create_volume.assert_not_called()
        t.pods.delete_volume.assert_not_called()

    def test_volume_created_only_when_missing(self):
        t = Mock()
        error = Exception()
        error.response = SimpleNamespace(status_code=404)
        t.pods.get_volume.side_effect = [error, {"status": "AVAILABLE"}]
        deploy.ensure_postgres_volume(t, allow_create=True)
        self.assertEqual(t.pods.create_volume.call_args.kwargs["volume_id"], deploy.POSTGRES_VOLUME)

    def test_missing_volume_for_existing_database_is_not_replaced(self):
        t = Mock()
        error = Exception()
        error.response = SimpleNamespace(status_code=404)
        t.pods.get_volume.side_effect = error
        with self.assertRaises(RuntimeError):
            deploy.ensure_postgres_volume(t)
        t.pods.create_volume.assert_not_called()

    def test_volume_error_does_not_create(self):
        t = Mock()
        t.pods.get_volume.side_effect = TimeoutError()
        with self.assertRaises(RuntimeError):
            deploy.ensure_postgres_volume(t)
        t.pods.create_volume.assert_not_called()

    def test_readiness_requires_new_container_and_successful_sql(self):
        t = Mock()
        t.pods.get_pod.side_effect = [
            {"status": "AVAILABLE", "status_container": {"start_time": "old"}},
            {"status": "AVAILABLE", "status_container": {"start_time": "new"}},
        ]
        t.pods.exec_pod_commands.return_value = {"execution_results": [{"exit_code": 0, "stdout": "1\n"}]}
        with patch.object(deploy.time, "sleep"):
            deploy.wait_for_postgres(t, "old", restarted=True)
        self.assertEqual(t.pods.get_pod.call_count, 2)
        t.pods.exec_pod_commands.assert_called_once()

    def test_restart_requires_old_timestamp(self):
        t = Mock()
        with self.assertRaises(RuntimeError):
            deploy.wait_for_postgres(t, restarted=True)
        t.pods.exec_pod_commands.assert_not_called()

    def test_missing_new_timestamp_does_not_confirm_restart(self):
        t = Mock()
        t.pods.get_pod.return_value = {"status": "AVAILABLE", "status_container": {}}
        with patch.object(deploy.time, "monotonic", side_effect=[0, 0, 601]), patch.object(deploy.time, "sleep"):
            with self.assertRaises(RuntimeError):
                deploy.wait_for_postgres(t, "old", restarted=True)
        t.pods.exec_pod_commands.assert_not_called()

    def test_conflicting_start_flags_rejected_before_any_connection(self):
        with self.assertRaises(SystemExit), patch("sys.stderr"):
            deploy.main(["--no-start", "--restart"])

    def test_no_start_rejects_image_mismatch_recovery(self):
        with self.assertRaises(SystemExit), patch("sys.stderr"):
            deploy.main(["--no-start", "--recreate-on-image-mismatch"])

    def test_recreate_modes_cannot_be_combined(self):
        with self.assertRaises(SystemExit), patch("sys.stderr"):
            deploy.main(["--recreate", "--recreate-on-image-mismatch"])

    def test_automated_restart_allowlist_excludes_postgres(self):
        selected = deploy.parse_pods("all")
        self.assertEqual(
            deploy.resolve_restart_pods(
                selected,
                restart=False,
                restart_pods="graphql,api,ensemble,svo,ui",
            ),
            ["graphql", "api", "ensemble", "svo", "ui"],
        )

    def test_postgres_is_not_restarted_when_omitted_from_allowlist(self):
        t = Mock()
        t.pods.get_pod.return_value = self.spec
        deploy.upsert_pod(t, self.spec, recreate=False, start=True, restart=False)
        t.pods.restart_pod.assert_not_called()
        t.pods.update_pod.assert_called_once()

    def test_postgres_transition_updates_image_without_recreating_volume(self):
        t = Mock()
        legacy = {**self.spec, "image": "postgis/postgis:16-3.5"}
        t.pods.get_pod.return_value = legacy
        with self.assertRaises(RuntimeError):
            deploy.upsert_pod(t, self.spec, recreate=False, start=True, restart=False)
        t.pods.update_pod.assert_not_called()
        t.pods.delete_pod.assert_not_called()

    def test_postgres_transition_replaces_only_the_pod_and_retains_volume(self):
        t = Mock()
        legacy = {**self.spec, "image": "postgis/postgis:16-3.5", "status": "AVAILABLE"}
        t.pods.get_pod.return_value = legacy
        with patch.object(deploy, "wait_for_pod_absent"), patch.object(
            deploy, "wait_for_pod_image"
        ):
            deploy.upsert_pod(
                t,
                self.spec,
                migrate_postgres_image=True,
                recreate=False,
                start=False,
                restart=True,
            )
        t.pods.delete_pod.assert_called_once_with(pod_id=deploy.PODS["postgres"])
        t.pods.create_pod.assert_called_once_with(**self.spec)
        t.pods.update_pod.assert_not_called()
        t.pods.delete_volume.assert_not_called()

    def test_restart_allowlist_is_limited_to_updated_pods(self):
        self.assertEqual(
            deploy.resolve_restart_pods(
                deploy.parse_pods("postgres,ui"),
                restart=False,
                restart_pods="redis,postgres,ui",
            ),
            ["postgres", "ui"],
        )

    def test_restart_modes_cannot_be_combined(self):
        with self.assertRaises(SystemExit):
            deploy.resolve_restart_pods(["ui"], restart=True, restart_pods="ui")

    def test_waits_are_bounded(self):
        with self.assertRaises(RuntimeError):
            deploy.wait_for_postgres(Mock(), timeout=0)
        t = Mock()
        t.pods.get_volume.return_value = {"status": "CREATING"}
        with self.assertRaises(RuntimeError):
            deploy.ensure_postgres_volume(t, timeout=0)

    def test_selector_keeps_dependency_order(self):
        self.assertEqual(deploy.parse_pods("graphql,postgres,postgres"), ["postgres", "graphql"])


class LifecycleTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {}, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.spec = deploy.build_specs("mintproject", "sha-new", "https://portals.tapis.io")["ui"]

    def test_image_verification_waits_for_eventual_consistency(self):
        old = {"image": "ghcr.io/mintproject/ui:sha-old"}
        new = {"image": self.spec["image"]}
        t = Mock()
        t.pods.get_pod.side_effect = [old, old, new]
        clock = [0]
        with patch.object(deploy.time, "monotonic", side_effect=lambda: clock[0]), patch.object(
            deploy.time, "sleep", side_effect=lambda _: clock.__setitem__(0, clock[0] + 1)
        ):
            result = deploy.wait_for_pod_image(t, self.spec["pod_id"], self.spec["image"], timeout=10)
        self.assertEqual(result, new)
        self.assertEqual(t.pods.get_pod.call_count, 3)

    def test_image_verification_timeout_is_fail_closed(self):
        t = Mock()
        with self.assertRaises(deploy.PodImageMismatchError) as ctx:
            deploy.wait_for_pod_image(t, self.spec["pod_id"], self.spec["image"], timeout=0)
        self.assertIn("did not converge", str(ctx.exception))

    def test_verification_lookup_errors_do_not_trigger_recovery(self):
        t = Mock()
        t.pods.get_pod.side_effect = RuntimeError("credentials must not leak")
        with self.assertRaises(RuntimeError) as ctx:
            deploy.wait_for_pod_image(t, self.spec["pod_id"], self.spec["image"])
        self.assertNotIn("credentials", str(ctx.exception))

    def test_transient_verification_lookup_is_retried(self):
        missing_connection = ConnectionError("connection closed")
        t = Mock()
        t.pods.get_pod.side_effect = [missing_connection, {"image": self.spec["image"]}]
        with patch.object(deploy.time, "sleep"):
            result = deploy.wait_for_pod_image(t, self.spec["pod_id"], self.spec["image"], timeout=10)
        self.assertEqual(result["image"], self.spec["image"])
        self.assertEqual(t.pods.get_pod.call_count, 2)

    def test_tapipy_transport_wrapper_is_retried(self):
        t = Mock()
        t.pods.get_pod.side_effect = [
            Exception("Unable to make request to Tapis server. Exception: connection reset"),
            {"image": self.spec["image"]},
        ]
        with patch.object(deploy.time, "sleep"):
            result = deploy.wait_for_pod_image(t, self.spec["pod_id"], self.spec["image"], timeout=10)
        self.assertEqual(result["image"], self.spec["image"])

    def test_http_verification_error_is_not_retried(self):
        error = Exception("unauthorized credentials")
        error.response = SimpleNamespace(status_code=401)
        t = Mock()
        t.pods.get_pod.side_effect = error
        with patch.object(deploy.time, "sleep"):
            with self.assertRaises(RuntimeError) as ctx:
                deploy.wait_for_pod_image(t, self.spec["pod_id"], self.spec["image"], timeout=10)
        self.assertIn("HTTP 401", str(ctx.exception))
        self.assertNotIn("credentials", str(ctx.exception))
        t.pods.get_pod.assert_called_once()

    def test_restart_happens_after_image_verification(self):
        existing = {"image": "old", "status_container": {"start_time": "old-start"}}
        updated = {"image": self.spec["image"]}
        ready = {"image": self.spec["image"], "status": "AVAILABLE", "status_container": {"start_time": "new-start"}}
        t = Mock()
        t.pods.get_pod.side_effect = [existing, updated, ready]
        events = []
        t.pods.update_pod.side_effect = lambda **_: events.append("update")
        t.pods.restart_pod.side_effect = lambda **_: events.append("restart")
        with patch.object(deploy.time, "sleep"), patch.object(
            deploy, "wait_for_pod_image", side_effect=lambda *_args, **_kwargs: events.append("verify")
        ), patch.object(deploy, "wait_for_pod_restart", side_effect=lambda *_args, **_kwargs: events.append("ready")):
            deploy.upsert_pod(t, self.spec, recreate=False, start=False, restart=True)
        self.assertEqual(events, ["update", "verify", "restart", "ready"])

    def test_restart_existing_pods_only_restarts_selected_apps(self):
        existing_api = {"image": "ghcr.io/mintproject/model-catalog-api:develop", "status_container": {"start_time": "api-old"}}
        existing_ui = {"image": "ghcr.io/mintproject/ui:develop", "status_container": {"start_time": "ui-old"}}
        t = Mock()
        t.pods.get_pod.side_effect = [existing_api, existing_ui]
        with patch.object(deploy, "wait_for_pod_restart") as ready:
            deploy.restart_existing_pods(t, ["api", "ui"])
        self.assertEqual(
            t.pods.restart_pod.call_args_list,
            [
                unittest.mock.call(pod_id=deploy.PODS["api"]),
                unittest.mock.call(pod_id=deploy.PODS["ui"]),
            ],
        )
        self.assertEqual(ready.call_count, 2)
        t.pods.update_pod.assert_not_called()
        t.pods.create_pod.assert_not_called()
        t.pods.delete_pod.assert_not_called()
        t.pods.set_pod_permission.assert_not_called()

    def test_restart_existing_pods_refuses_missing_pod(self):
        missing = Exception()
        missing.response = SimpleNamespace(status_code=404)
        t = Mock()
        t.pods.get_pod.side_effect = missing
        with self.assertRaises(RuntimeError) as ctx:
            deploy.restart_existing_pods(t, ["api"])
        self.assertIn("will not create it", str(ctx.exception))
        t.pods.restart_pod.assert_not_called()
        t.pods.create_pod.assert_not_called()

    def test_restart_existing_pods_rejects_protected_services(self):
        with self.assertRaises(RuntimeError):
            deploy.restart_existing_pods(Mock(), ["graphql"])

    def test_mismatch_without_opt_in_does_not_delete_or_restart(self):
        t = Mock()
        t.pods.get_pod.return_value = self.spec
        with patch.object(deploy, "wait_for_pod_image", side_effect=deploy.PodImageMismatchError("stale")):
            with self.assertRaises(deploy.PodImageMismatchError):
                deploy.upsert_pod(t, self.spec, recreate=False, start=False, restart=True)
        t.pods.delete_pod.assert_not_called()
        t.pods.restart_pod.assert_not_called()

    def test_opt_in_recovery_recreates_ui_after_confirmed_delete(self):
        missing = Exception()
        missing.response = SimpleNamespace(status_code=404)
        t = Mock()
        t.pods.get_pod.side_effect = [self.spec, missing]
        with patch.object(
            deploy,
            "wait_for_pod_image",
            side_effect=[deploy.PodImageMismatchError("stale"), self.spec],
        ):
            deploy.upsert_pod(
                t,
                self.spec,
                recreate=False,
                recreate_on_image_mismatch=True,
                start=False,
                restart=True,
            )
        t.pods.delete_pod.assert_called_once_with(pod_id=deploy.PODS["ui"])
        t.pods.create_pod.assert_called_once_with(**self.spec)
        t.pods.restart_pod.assert_not_called()

    def test_opt_in_recovery_cannot_recreate_postgres(self):
        postgres = deploy.build_specs("mintproject", "sha-new", "https://portals.tapis.io")["postgres"]
        t = Mock()
        t.pods.get_pod.return_value = postgres
        with patch.object(deploy, "wait_for_pod_image", side_effect=deploy.PodImageMismatchError("stale")):
            with self.assertRaises(RuntimeError) as ctx:
                deploy.upsert_pod(
                    t,
                    postgres,
                    recreate=False,
                    recreate_on_image_mismatch=True,
                    start=False,
                    restart=False,
                )
        self.assertIn("protected pod", str(ctx.exception))
        t.pods.delete_pod.assert_not_called()
        t.pods.create_pod.assert_not_called()

    def test_opt_in_recovery_cannot_recreate_redis(self):
        redis = deploy.build_specs("mintproject", "sha-new", "https://portals.tapis.io")["redis"]
        t = Mock()
        t.pods.get_pod.return_value = redis
        with patch.object(deploy, "wait_for_pod_image", side_effect=deploy.PodImageMismatchError("stale")):
            with self.assertRaises(RuntimeError) as ctx:
                deploy.upsert_pod(
                    t,
                    redis,
                    recreate=False,
                    recreate_on_image_mismatch=True,
                    start=False,
                    restart=False,
                )
        self.assertIn("protected pod", str(ctx.exception))
        t.pods.delete_pod.assert_not_called()
        t.pods.create_pod.assert_not_called()

    def test_delete_wait_requires_confirmed_404(self):
        t = Mock()
        error = Exception()
        error.response = SimpleNamespace(status_code=403)
        t.pods.get_pod.side_effect = error
        with self.assertRaises(RuntimeError):
            deploy.wait_for_pod_absent(t, deploy.PODS["ui"], timeout=1)


if __name__ == "__main__":
    unittest.main()
