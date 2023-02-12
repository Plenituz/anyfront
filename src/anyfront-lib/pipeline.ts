import { SugarCoatedDatabag, ImportComponentInput, DatabagContainer, importComponents, applyTransformers, exportDatabags } from '../../../barbe-serverless/src/barbe-std/utils';

export function mergeDatabagContainers(...containers: DatabagContainer[]): DatabagContainer {
    let output: DatabagContainer = {}
    for(const container of containers) {
        for(const [blockType, block] of Object.entries(container)) {
            output[blockType] = output[blockType] || {}
            for(const [bagName, bag] of Object.entries(block)) {
                output[blockType][bagName] = output[blockType][bagName] || []
                output[blockType][bagName].push(...bag)
            }
        }
    }
    return output
}

export function executePipelineGroup(container: DatabagContainer, pipelines: Pipeline[]) {
    let maxStep = pipelines.map(p => p.steps.length).reduce((a, b) => Math.max(a, b), 0);
    let previousStepResult: DatabagContainer = {};
    let history: DatabagContainer[] = [];
    for(let i = 0; i < maxStep; i++) {
        let stepResults: DatabagContainer = {}
        let stepImports: ImportComponentInput[] = []
        let stepTransforms: SugarCoatedDatabag[] = []
        let stepDatabags: SugarCoatedDatabag[] = []

        for(let pipeline of pipelines) {
            if(i >= pipeline.steps.length) {
                continue;
            }
            let stepRequests = pipeline.steps[i]({
                previousStepResult,
                history
            });
            // console.log(`step ${i} requests:`, JSON.stringify(stepRequests))
            if(!stepRequests) {
                continue;
            }
            if(stepRequests.imports) {
                stepImports.push(...stepRequests.imports);
            }
            if(stepRequests.transforms) {
                stepTransforms.push(...stepRequests.transforms);
            }
            if(stepRequests.databags) {
                stepDatabags.push(...stepRequests.databags);
            }
        }
        if(stepImports.length > 0) {
            const importsResults = importComponents(container, stepImports);
            stepResults = mergeDatabagContainers(stepResults, importsResults);
        }
        if(stepTransforms.length > 0) {
            const transformResults = applyTransformers(stepTransforms);
            stepResults = mergeDatabagContainers(stepResults, transformResults);
        }
        if(stepDatabags.length > 0) {
            exportDatabags(stepDatabags)
        }
        history.push(previousStepResult);
        previousStepResult = stepResults;
    }
}

export type StepInput = {
    previousStepResult: DatabagContainer
    history: DatabagContainer[]
}

export type StepOutput = {
    imports?: ImportComponentInput[]
    transforms?: SugarCoatedDatabag[]
    databags?: SugarCoatedDatabag[]
}

export type Step = (input: StepInput) => StepOutput | void;
export type Pipeline = {
    steps: Step[]
}