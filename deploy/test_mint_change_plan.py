import unittest

from mint_change_plan import SERVICE_ORDER, make_plan


class MintChangePlanTests(unittest.TestCase):
    def test_service_paths_build_and_restart_only_that_service(self):
        plan = make_plan(["ui-react/src/App.tsx"], "abcdef123456")
        self.assertEqual(plan["build_services"], ["ui"])
        self.assertEqual(plan["restart_services"], ["ui"])
        self.assertFalse(plan["deploy_all"])
        self.assertEqual(plan["images"]["ui"]["tag"], "sha-abcdef1")

    def test_each_owned_service_has_a_build_matrix_entry(self):
        expected = {
            "graphql_engine/schema.sql": "graphql",
            "docker/postgres-pgvector/Dockerfile": "postgres",
            "model-catalog-api/main.py": "api",
            "mint-ensemble-manager/main.py": "ensemble",
            "svo-adapter-service/main.py": "svo",
            "semantic-search-service/main.py": "semantic_search",
            "ui-react/src/App.tsx": "ui",
        }
        for path, service in expected.items():
            with self.subTest(path=path):
                plan = make_plan([path], "abcdef123456")
                self.assertEqual(plan["build_services"], [service])
                self.assertEqual(plan["matrix"]["include"][0]["service"], service)
                self.assertEqual(plan["images"][service]["image_ref"].split(":", 1)[1], "sha-abcdef1")

    def test_schema_changes_build_graphql_and_restart_semantic(self):
        plan = make_plan(["graphql_engine/migrations/1_add_table/up.sql"], "abcdef1")
        self.assertEqual(plan["build_services"], ["graphql"])
        self.assertEqual(plan["restart_services"], ["graphql", "semantic_search"])
        self.assertTrue(plan["schema_changed"])

    def test_postgres_changes_restart_database_dependents(self):
        plan = make_plan(["docker/postgres-pgvector/Dockerfile"])
        self.assertEqual(plan["build_services"], ["postgres"])
        self.assertEqual(
            plan["restart_services"],
            ["postgres", "graphql", "api", "ensemble", "svo", "semantic_search"],
        )

    def test_shared_and_unknown_paths_fail_closed_to_full_stack(self):
        for path in ("Makefile", "unknown.txt"):
            with self.subTest(path=path):
                plan = make_plan([path])
                self.assertTrue(plan["deploy_all"])
                self.assertEqual(plan["build_services"], list(SERVICE_ORDER))
                self.assertEqual(plan["restart_services"], list(SERVICE_ORDER))

    def test_ci_and_deployment_plumbing_changes_are_noop(self):
        for path in (".github/workflows/build.yml", "deploy/tapis/register_mint_stack.py", "deploy/mint_change_plan.py"):
            with self.subTest(path=path):
                plan = make_plan([path])
                self.assertFalse(plan["has_changes"])
                self.assertFalse(plan["deploy_all"])

    def test_service_change_with_ci_change_does_not_expand_to_full_stack(self):
        plan = make_plan(["ui-react/src/App.tsx", ".github/workflows/build.yml"])
        self.assertEqual(plan["build_services"], ["ui"])
        self.assertEqual(plan["restart_services"], ["ui"])

    def test_documentation_only_change_is_noop(self):
        plan = make_plan(["docs/deploy/mint-dev-pods.md", "README.md"])
        self.assertFalse(plan["has_changes"])
        self.assertEqual(plan["build_services"], [])
        self.assertEqual(plan["restart_services"], [])

    def test_multi_service_order_is_canonical_and_duplicates_are_removed(self):
        plan = make_plan(["ui-react/a.tsx", "semantic-search-service/main.py", "ui-react/b.tsx"])
        self.assertEqual(plan["build_services"], ["semantic_search", "ui"])
        self.assertEqual(plan["restart_services"], ["semantic_search", "ui"])


if __name__ == "__main__":
    unittest.main()
