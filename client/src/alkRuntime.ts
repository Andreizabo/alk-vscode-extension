import { EventEmitter } from "events";
import { getOptionsString, getUserQuickPick, showInfoMessage, highlightLine, clearHighlights } from "./helpers";
import * as os from "os";

export interface IRuntimeBreakpoint 
{
	id: number;
	line: number;
	verified: boolean;
}

interface IRuntimeStackFrame 
{
	index: number;
	name: string;
	line: number;
}

interface IRuntimeStack 
{
	count: number;
	frames: IRuntimeStackFrame[];
}

export class AlkRuntime extends EventEmitter
{
    private _childProcess: any;
    private breakpointId: number = 0;
    private _breakpoints = new Map<string, IRuntimeBreakpoint[]>();
    private _mainFile: string = '';
    private _alkOutput: string = '';
    private _alkOutputLines: string[] = [];
    private _commandOutput = new Map<string, string[][]>();
    private _linesSkipped = 0;
    private _inChoose = false;
    private _chooseLines: string[] = [];
    private _chooseTitle = '';
    private _waitingForOutput = false;

    public constructor()
    {
        super();
    }

    public async start(alkPath: string, mainFile: string): Promise<void>
    {
        this._mainFile = mainFile;
        const options = getOptionsString(false);
        let command = '', args = [];
        
        if (os.type() === 'Windows_NT')
        {
            command = `"${alkPath}"`;
            args = ['-a', `"${mainFile}"`, '-d', '-dm', options];
        }
        else
        {
            command = '/bin/bash';
            args = [alkPath, '-a', `${mainFile}`, '-d', '-dm', options];
        }
        const cp = require('child_process');
        this._childProcess = cp.spawn(command, args, {
            stdio: 'pipe',
            shell: true
        });
        this._childProcess.stdout.on('data', async (data: any) => {
            for (let c of data.toString())
            {
                this._alkOutput += c;
                if (c === '\n')
                {
                    if (os.type() === 'Windows_NT' && this._linesSkipped < 4)
                    {
                        this._linesSkipped++;
                        this._alkOutput = '';
                    }
                    else
                    {
                        if (this._alkOutput.includes('Select the index of the value you want for "'))
                        {
                            this._chooseTitle = this._alkOutput.slice();
                            const line = parseInt(this._alkOutput.substring(this._alkOutput.indexOf('on line ') + 8)) - 1;
                            highlightLine([line], line);
                        }
                        else if (this._alkOutput.includes('--- begin <choose> ---'))
                        {
                            this._inChoose = true;
                            // this.sendEvent('stopOnBreakpoint');
                        }
                        else if (this._alkOutput.includes('--- end <choose> ---'))
                        {
                            this._inChoose = false;
                            let option = await getUserQuickPick(this._chooseLines, this._chooseTitle);
                            while (!option)
                            {
                                option = await getUserQuickPick(this._chooseLines, this._chooseTitle);
                            }
                            this._chooseLines = [];
                            if (option.includes('Use "more" to see the next'))
                            {
                                this._childProcess.stdin.write('more\n');
                            }
                            else
                            {
                                this._childProcess.stdin.write(option.substring(0, option.indexOf('.')) + '\n');
                                clearHighlights();
                            }
                        }
                        else if (this._alkOutput.includes('--- begin <'))
                        {
                            this._alkOutputLines = [];
                        }
                        else if (this._alkOutput.includes('--- end <'))
                        {
                            let index = this._alkOutput.indexOf('> ---');
                            const command = this._alkOutput.substring(9, index);
                            if (!this._commandOutput.has(command))
                            {
                                this._commandOutput.set(command, []);
                            }
                            this._commandOutput.get(command)?.push(this._alkOutputLines);
                            this._alkOutputLines = [];
                        }
                        else if (!this._alkOutput.includes('Entered function ') && !this._alkOutput.includes('Exited function '))
                        {
                            if (this._inChoose)
                            {
                                this._chooseLines.push(this._alkOutput.slice());
                            }
                            else
                            {
                                this._alkOutputLines.push(this._alkOutput.slice());
                            }
                        }
                        this._alkOutput = '';
                    }
                }
            }
        });
        this._childProcess.stderr.on('data', (data: any) => {
            this.sendEvent('output', 'stderr', data.toString());
        });
        this._childProcess.on('close', (code: number) => {
            console.log(`child process exited with code ${code}`);
            this._alkOutputLines.push('Current line -> ');
            this.sendEvent('end');
        });
        this._childProcess.on('error', (err: any) => {
            console.log(err);
        });
        this._alkOutputLines = [];
        this.verifyBreakpoints(mainFile);
        const bps = this._breakpoints.get(mainFile) || [];
        for (let bp of bps)
        {
            await this.writeCommand(`break ${bp.line}\n`);
        }
        this.sendEvent('stopOnEntry');
    }

    public terminate(): void
    {
        this._childProcess.kill();
    }

    public async setBreakpoint(line: number, file: string): Promise<IRuntimeBreakpoint>
    {
        console.log(`setBreakpoint ${line} ${file}`);
		const bp: IRuntimeBreakpoint = { verified: false, line, id: this.breakpointId++ };
        let bps = this._breakpoints.get(file);
		if (!bps) 
        {
			bps = new Array<IRuntimeBreakpoint>();
			this._breakpoints.set(file, bps);
		}
		bps.push(bp);

        this.verifyBreakpoints(file);

        await this.writeCommand(`break ${line}\n`);

		return bp;
    }

    public getBreakpoints(): IRuntimeBreakpoint[]
    {
        return this._breakpoints.get(this._mainFile) || [];
    }

    public async clearBreakpoints() : Promise<void>
    {
        await this.writeCommand(`clear\n`);
    }

    public verifyBreakpoints(path: string): void
    {
        const bps = this._breakpoints.get(path);
		if (bps) 
        {
			bps.forEach(bp => {
				if (!bp.verified) 
                {
                    bp.verified = true;
                    this.sendEvent('breakpointValidated', bp);
				}
			});
		}
    }

    public async stackTrace(startFrame: number, endFrame: number): Promise<IRuntimeStack>
    {
        const output = await this.writeCommand('backtrace\n');

        const backtraceLines = output.filter(l => l.includes(' at line '));

        const stack = backtraceLines.map((line, index) => {
            const [name, lineNumber] = line.split(' at line ');
            return {
                index: index,
                name: name,
                line: parseInt(lineNumber)
            } as IRuntimeStackFrame;
        });
        return {
            count: stack.length,
            frames: stack
        };
    }

    public async eval(expression: string): Promise<string | undefined>
    {
        let output = await this.writeCommand(`print ${expression}\n`);
        output = output.filter(l => !l.includes('Current line -> '));
        if (output.length > 0)
        {
            return output[0];
        }
        return undefined;
    }

    public async next(): Promise<void>
    {
        const output = await this.writeCommand('next\n');
        this._waitingForOutput = true;
        this.printProgramOutput(output);
        this._waitingForOutput = false;
        this.sendEvent('stopOnStep');
    }

    public async step(): Promise<void>
    {
        const output = await this.writeCommand('step\n');
        this._waitingForOutput = true;
        this.printProgramOutput(output);
        this._waitingForOutput = false;
        this.sendEvent('stopOnStep');
    }

    public async continue(): Promise<void>
    {
        const output = await this.writeCommand('continue\n');
        this._waitingForOutput = true;
        this.printProgramOutput(output);
        this._waitingForOutput = false;
        this.sendEvent('stopOnBreakpoint');
    }

    public async stepOut(): Promise<void>
    {
        const output = await this.writeCommand('finish\n');
        this._waitingForOutput = true;
        this.printProgramOutput(output);
        this._waitingForOutput = false;
        this.sendEvent('stopOnStep');
    }

    public async back(): Promise<void>
    {
        const output = await this.writeCommand('back\n');
        if (output[0].includes('No checkpoints'))
        {
            showInfoMessage('No checkpoints');
        }
        else
        {
            const title = output[0].trim();
            let checkpoints = [];
            let checkpointLines: number[] = [];
            for (let i = 1; i < output.length; i += 2)
            {
                const aux = `${output[i].trim()} ${output[i + 1].trim()}`;
                checkpoints.push(aux);
                checkpointLines.push(parseInt(aux.substring(aux.indexOf('Current line -> ') + 16, aux.indexOf('.'))) - 1);
            }
            const highlightChoice = (item: string) => {
                const line = parseInt(item.substring(item.indexOf('Current line -> ') + 16, item.indexOf('.'))) - 1;
                highlightLine(checkpointLines, line);
            };
            let choice = await getUserQuickPick(checkpoints, title, highlightChoice);
            while (!choice)
            {
                choice = await getUserQuickPick(checkpoints, title, highlightChoice);
            }
            this._childProcess.stdin.write(choice.substring(11, choice.indexOf(':')) + '\n');
            clearHighlights();
        }
        this.sendEvent('stopOnStep');
    }

    public printAll(): void
    {
        while (this._waitingForOutput)
        {}
        const toPrint = this._alkOutputLines.filter(l => l.includes('|->'));
        for (let line of toPrint)
        {
            this.sendEvent('output', 'stdout', line);
        }
    }

    private async writeCommand(command: string): Promise<string[]>
    {
        if (!this._childProcess)
        {
            console.log(`Tried to run ${command} but debugger is not active`);
            return [];
        }
        this._childProcess.stdin.write(command);
        const trimmedCommand = command.trim();
        await this.waitForCommand(trimmedCommand);
        console.log(`Command: ${command}`);
        let commandOutputArray = this._commandOutput.get(trimmedCommand) || [['???']];
        const commandOutput = commandOutputArray[0];
        commandOutputArray.shift();

        console.log(`Command output: ${commandOutput}`);
        return commandOutput;
    }

    private sendEvent(event: string, ... args: any[]) 
    {
		setImmediate(_ => {
			this.emit(event, ...args);
		});
	}

    private printProgramOutput(lines: string[]): void
    {
        const toPrint = lines.filter(l => !l.includes('Current line -> '));
        for (let line of toPrint)
        {
            this.sendEvent('output', 'stdout', line);
        }
    }

    private async waitForCommand(command: string): Promise<void>
    {
        await new Promise<void>(async resolve => {
            (function wait(output: Map<string, string[][]>, command: string)
            {
                if (output.has(command))
                {
                    let lines = output.get(command) || [];
                    if (lines.length > 0)
                    {
                        return resolve();
                    }
                }
                setTimeout(() => wait(output, command), 50);
            })(this._commandOutput, command);
        });
    }
}