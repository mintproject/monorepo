import { print } from "graphql";
import listExecutionHistoryGQL from "@/classes/graphql/queries/execution/list-history.graphql";

describe("execution history query", () => {
    it("orders the join rows through the related execution fields", () => {
        const query = print(listExecutionHistoryGQL);

        expect(query).toMatch(/order_by:\s*\[\s*\{\s*execution:\s*\{\s*start_time:\s*desc/s);
        expect(query).toMatch(/\{\s*execution:\s*\{\s*id:\s*desc/s);
        expect(query).not.toMatch(/order_by:\s*\[\s*\{\s*start_time:/s);
    });
});
