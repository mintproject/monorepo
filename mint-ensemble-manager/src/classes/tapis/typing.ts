import {
    ComponentArgument,
    ComponentDataBindings,
    ComponentParameterBindings,
    ComponentParameterTypes
} from "@/classes/localex/local-execution-types";
import { Execution } from "@/classes/mint/mint-types";

export type TapisComponent = {
    id: string;
    version: string;
    rundir: string;
    softwareImage?: string;
    inputs: ComponentArgument[];
    outputs: ComponentArgument[];
};

export interface TapisComponentSeed {
    component: TapisComponent;
    execution: Execution;
    datasets: ComponentDataBindings;
    parameters: ComponentParameterBindings;
    paramtypes: ComponentParameterTypes;
    tapisAppId?: string;
    tapisAppVersion?: string;
}
