import useModelInputService from "./useModelService/useModelInputService";
import useModelParameterService from "./useModelService/useModelParameterService";

const useModelsService = {
    getDataBindingsByModelId: useModelInputService.getDataBindingsByModelId,
    getModelParametersByModelId: useModelParameterService.getModelParametersByModelId,
    setParameterBindings: useModelParameterService.setParameterBindings,
    setInputBindings: useModelInputService.setInputBindings
};

export default useModelsService;
