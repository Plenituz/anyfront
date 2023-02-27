import { SugarCoatedDatabag, ImportComponentInput, DatabagContainer, importComponents, applyTransformers, exportDatabags, onlyRunForLifecycleSteps, barbeLifecycleStep, LifecycleStep, IS_VERBOSE } from '../../../barbe-serverless/src/barbe-std/utils';

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

export function databagArrayToContainer(array: SugarCoatedDatabag[]): DatabagContainer {
    let output: DatabagContainer = {}
    for(const bag of array) {
        output[bag.Type] = output[bag.Type] || {}
        output[bag.Type][bag.Name] = output[bag.Type][bag.Name] || []
        output[bag.Type][bag.Name].push(bag)
    }
    return output
}

//modifies the original, but also returns it for convenience
export function addToStepOutput(original: StepOutput, ...outputs: StepOutput[]): StepOutput {
    for(const output of outputs) {
        if(output.imports) {
            if(!original.imports) {
                original.imports = []
            }
            original.imports.push(...output.imports)
        }
        if(output.databags) {
            if(!original.databags) {
                original.databags = []
            }
            original.databags.push(...output.databags)
        }
        if(output.transforms) {
            if(!original.transforms) {
                original.transforms = []
            }
            original.transforms.push(...output.transforms)
        }
    }
    return original
}

export type HistoryItem = {
    stepNames: string[]
    databags: DatabagContainer
}

export function executePipelineGroup(container: DatabagContainer, pipelines: Pipeline[]) {
    const lifecycleStep = barbeLifecycleStep();
    const maxStep = pipelines.map(p => p.steps.length).reduce((a, b) => Math.max(a, b), 0);
    let previousStepResult: DatabagContainer = {};
    let history: HistoryItem[] = [];
    for(let i = 0; i < maxStep; i++) {
        let stepResults: DatabagContainer = {}
        let stepImports: ImportComponentInput[] = []
        let stepTransforms: SugarCoatedDatabag[] = []
        let stepDatabags: SugarCoatedDatabag[] = []
        let stepNames: string[] = []

        for(let pipeline of pipelines) {
            if(i >= pipeline.steps.length) {
                continue;
            }
            const stepMeta = pipeline.steps[i]
            if(stepMeta.name) {
                stepNames.push(stepMeta.name)
            }
            if(stepMeta.lifecycleSteps && stepMeta.lifecycleSteps.length > 0) {
                if (!stepMeta.lifecycleSteps.includes(lifecycleStep)) {
                    if(IS_VERBOSE) {
                        console.log(`${pipeline.name}: skipping step ${i}${stepMeta.name ? ` (${stepMeta.name})` : ''} (${lifecycleStep} not in [${stepMeta.lifecycleSteps.join(', ')}]`)
                    }
                    continue
                }
            }
            if(IS_VERBOSE) {
                console.log(`${pipeline.name}: running step ${i}${stepMeta.name ? ` (${stepMeta.name})` : ''}`)
                console.log(`step ${i} input:`, JSON.stringify(previousStepResult))
            }
            let stepRequests = stepMeta.f({
                previousStepResult,
                history
            });
            if(IS_VERBOSE) {
                console.log(`${pipeline.name}: step ${i}${stepMeta.name ? ` (${stepMeta.name})` : ''} requests:`, JSON.stringify(stepRequests))
            }
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
            stepResults = mergeDatabagContainers(stepResults, databagArrayToContainer(stepDatabags));
        }
        if(IS_VERBOSE) {
            console.log(`step ${i} output:`, JSON.stringify(stepResults))
        }
        history.push({
            databags: stepResults,
            stepNames
        });
        previousStepResult = stepResults;
        for(let pipeline of pipelines) {
            pipeline.mostRecentInput = {
                previousStepResult,
                history
            }
        }
    }
}

export type StepInput = {
    previousStepResult: DatabagContainer
    history: HistoryItem[]
}

export type StepOutput = {
    imports?: ImportComponentInput[]
    transforms?: SugarCoatedDatabag[]
    databags?: SugarCoatedDatabag[]
}

export type Step = {
    name?: string
    lifecycleSteps?: LifecycleStep[]
    f: (input: StepInput) => StepOutput | void;
}
export type Pipeline = {
    name?: string
    mostRecentInput?: StepInput
    steps: Step[]
}

export type PipelineWithFuncs = Pipeline & {
    runAfter(other: Pipeline): void
    merge(...steps: Step[]): void
    pushWithParams(params: Omit<Step, 'f'>, f: (input: StepInput) => StepOutput | void): void
    push(f: (input: StepInput) => StepOutput | void): void
}

export function getHistoryItem(history: HistoryItem[], stepName: string) {
    for(const item of history) {
        if(item.stepNames.includes(stepName)) {
            return item;
        }
    }
    return null;
}

export function step(f: (input: StepInput) => StepOutput | void, params?: Omit<Step, 'f'>): Step {
    return {
        ...params,
        f
    };
}

export function pipeline(steps: Step[], params?: Omit<Pipeline, 'steps'>): PipelineWithFuncs {
    return {
        ...params,
        steps,
        pushWithParams(params: Omit<Step, 'f'>, f: (input: StepInput) => StepOutput | void) {
            this.steps.push(step(f, params))
        },
        push(f: (input: StepInput) => StepOutput | void) {
            this.steps.push(step(f))
        },
        merge(...steps: Step[]) {
            this.steps.push(...steps)
        },
        runAfter(other: Pipeline) {
            this.steps = [
                ...Array.from({length: other.steps.length}, () => step(() => {}, { name: `padding_${other.name || ''}` })),
                ...this.steps
            ]
        }
    }
}
