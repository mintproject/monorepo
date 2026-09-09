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
        self.assertEqual(self.spec["image"], "postgis/postgis:16-3.5")
        data = self.spec["environment_variables"]["PGDATA"]
        mount, source = next(iter(self.spec["volume_mounts"].items()))
        self.assertTrue(data.startswith(mount + "/"))
        self.assertEqual(source["type"], "tapisvolume")
        self.assertEqual(source["source_id"], "mintdevpostgresdata")

    def test_existing_storage_can_be_reused(self):
        deploy.check_postgres_storage(self.spec, recreate=False)

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

    def test_automated_restart_allowlist_excludes_postgres(self):
        selected = deploy.parse_pods("all")
        self.assertEqual(
            deploy.resolve_restart_pods(
                selected,
                restart=False,
                restart_pods="redis,graphql,api,ensemble,svo,ui",
            ),
            ["redis", "graphql", "api", "ensemble", "svo", "ui"],
        )

    def test_postgres_is_not_restarted_when_omitted_from_allowlist(self):
        t = Mock()
        t.pods.get_pod.return_value = self.spec
        deploy.upsert_pod(t, self.spec, recreate=False, start=True, restart=False)
        t.pods.restart_pod.assert_not_called()
        t.pods.update_pod.assert_called_once()

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


if __name__ == "__main__":
    unittest.main()
