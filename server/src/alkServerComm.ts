import { EventEmitter } from "events";
import * as os from "os";

export class AlkServerComm extends EventEmitter
{
    private _childProcess: any;
    private _alkOutput: string = '';
    private _alkOutputLines: string[] = [];
    private _commandOutput = new Map<string, string[][]>();

    public constructor()
    {
        super();
    }

    public async start(alkPath: string): Promise<void>
    {
        let command = '', args: any = [];
        
        if (os.type() === 'Windows_NT')
        {
            command = alkPath;
            args = [];
        }
        else
        {
            command = '/bin/bash';
            args = [alkPath];
        }
        const cp = require('child_process');
        this._childProcess = cp.spawn(command, args, {
            stdio: 'pipe'
        });
        this._childProcess.stdout.on('data', async (data: any) => {
            for (let c of data.toString())
            {
                this._alkOutput += c;
                if (c === '\n')
                {
                    if (this._alkOutput.includes('--- begin <'))
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
                    else
                    {
                        this._alkOutputLines.push(this._alkOutput.slice());
                    }
                    this._alkOutput = '';
                }
            }
        });
        this._childProcess.on('close', (code: number) => {
            console.log(`child process exited with code ${code}`);
            this.sendEvent('end');
        });
        this._childProcess.on('error', (err: any) => {
            console.log(err);
        });
        this._alkOutputLines = [];
    }

    public terminate(): void
    {
        this._childProcess.kill();
    }

    public async writeCommand(command: string, args: string[] = []): Promise<string[]>
    {
        if (!this._childProcess)
        {
            console.log(`Tried to run ${command} but language server is not active`);
            return [];
        }
        this._childProcess.stdin.write(command);
        for (let i = 0; i < args.length; ++i) {
            this._childProcess.stdin.write(args[i]);
        }
        const trimmedCommand = command.trim();
        console.log(`Command: ${command}`);
        await this.waitForCommand(trimmedCommand);
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

    public async waitForCommand(command: string): Promise<void>
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