import { ChildProcess, exec, execSync } from 'child_process';
import { EventEmitter } from 'events';
import * as os from 'os';
import { Common } from './common';

export class ExecJob {
    private _serial: string;
    private _jobcode: string;
    private _command: string;
    private _returnCode: string;
    private _exceptionMes: string;
    private process?: ChildProcess;
    private _events: EventEmitter = new EventEmitter();
    private _echorc: string;

    constructor(serial: string, jobcode: string, command: string) {
        this._serial = serial;
        this._jobcode = jobcode;
        this._command = command;
        this._returnCode = '';
        this._exceptionMes = '';
        this._echorc = os.type().match('Windows_NT') !== null ? 'echo %ERRORLEVEL%' : 'echo $?';
    }

    public get serial(): string {
        return this._serial;
    }

    public get jobcode(): string {
        return this._jobcode;
    }

    public get command(): string {
        return this._command;
    }

    public get returnCode(): string {
        return this._returnCode;
    }

    public set returnCode(value: string) {
        this._returnCode = value;
    }

    public get exceptionMes(): string {
        return this._exceptionMes;
    }

    public set exceptionMes(value: string) {
        this._exceptionMes = value;
    }

    public get events(): EventEmitter {
        return this._events;
    }

    public get echorc(): string {
        return this._echorc;
    }

    /**
     * ジョブの実行
     * ここはやっぱりexecFileで書き換える
     */
    public exec(): void {
        // tslint:disable-next-line:no-magic-numbers
        this.process = exec(this.command, { 'maxBuffer': 400 * 1024 }, (error: Error | null, stdout: string, stderr: string) => {
            if (error !== null) {
                this.returnCode = '500';
                this.exceptionMes = error.message;
                this.events.emit('ExecError');

                return;
            }

            this.returnCode = execSync(this.echorc).toString();
            this.events.emit('ExecSuccess', stdout, stderr);
            this.process = undefined;

        });
        Common.trace(Common.STATE_INFO, `コマンドを実行しました。（cmd：${this.command}、PID：${this.process.pid}）`);
    }

    public kill(): void {
        if (typeof this.process === 'undefined') return;
        this.process.kill();
        this.returnCode = '-1';
        this.exceptionMes = 'KILL SIGNAL';
        this.events.emit('ExecKilled');
        Common.trace(Common.STATE_ERROR, `コマンドを強制終了しました。（cmd：${this.command}、PID：${this.process.pid}）`);
        this.process = undefined;
    }

}
