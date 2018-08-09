import { ChildProcess, execFile, execSync } from 'child_process';
import { EventEmitter } from 'events';
import * as os from 'os';
import { Common } from './common';
import { RunDate, SerialJobJSON } from './interface';

export class ExecJob implements SerialJobJSON {
    private serialJob: SerialJobJSON;
    private process?: ChildProcess;
    private _events: EventEmitter = new EventEmitter();
    private _echorc: string;

    constructor(serialJob: SerialJobJSON) {
        this.serialJob = serialJob;
        this._echorc = os.type().match('Windows_NT') !== null ? 'echo %ERRORLEVEL%' : 'echo $?';
    }

    public get serial(): string {
        return this.serialJob.serial;
    }

    public get code(): string {
        return this.serialJob.code;
    }

    public get agentName(): string {
        return this.serialJob.agentName;
    }

    public get schedule(): RunDate {
        return this.serialJob.schedule;
    }
    public get file(): string | undefined {
        return this.serialJob.file;
    }

    public get args(): string[] | undefined {
        return this.serialJob.args;
    }

    public get info(): string {
        return this.serialJob.info;
    }

    public get returnCode(): string | undefined {
        return this.serialJob.returnCode;
    }

    public set returnCode(value: string | undefined) {
        this.serialJob.returnCode = value;
    }

    public get exceptionMes(): string | undefined {
        return this.serialJob.exceptionMes;
    }

    public set exceptionMes(value: string | undefined) {
        this.serialJob.exceptionMes = value;
    }

    public get cwd(): string {
        return this.serialJob.cwd || './';
    }

    public get isSpecial(): boolean {
        return this.serialJob.isSpecial;
    }

    public get events(): EventEmitter {
        return this._events;
    }

    public get echorc(): string {
        return this._echorc;
    }

    /**
     * ジョブの実行
     */
    public exec(): void {
        if (typeof this.file === 'undefined') {
            this.returnCode = '404';
            this.exceptionMes = '実行ファイルが設定されていません。';
            this.events.emit(Common.EVENT_EXEC_ERROR);

            return;
        }
        // tslint:disable-next-line:no-magic-numbers
        this.process = execFile(this.file, this.args, { 'maxBuffer': 400 * 1024, 'cwd': this.cwd, 'timeout': 30 * 1000, 'shell': true }, (error: Error | null, stdout: string, stderr: string) => {
            if (error !== null) {
                this.returnCode = '500';
                this.exceptionMes = error.message;
                this.events.emit(Common.EVENT_EXEC_ERROR);
                Common.trace(Common.STATE_INFO, `ジョブが失敗しました。（execFile：${this.file}、RC：${this.returnCode}、ErrorMes：${this.exceptionMes}）`);

                return;
            }

            this.returnCode = execSync(this.echorc).toString();
            this.events.emit(Common.EVENT_EXEC_SUCCESS, stdout, stderr);
            Common.trace(Common.STATE_INFO, `ジョブが成功しました。（execFile：${this.file}、RC：${this.returnCode}）`);
            this.process = undefined;

        });
        Common.trace(Common.STATE_DEBUG, `file:${this.file}, args:${JSON.stringify(this.args)}, cwd:${this.cwd}`);
        Common.trace(Common.STATE_INFO, `ジョブを実行しました。（execFile：${this.file}、PID：${this.process.pid}）`);
    }

    /**
     * ジョブを強制終了します。
     */
    public kill(): void {
        if (typeof this.process === 'undefined') {
            Common.trace(Common.STATE_ERROR, `ジョブはすでに終了しています。（execFile：${this.file}）`);

            return;
        }
        this.process.kill();
        this.returnCode = '-1';
        this.exceptionMes = 'KILL SIGNAL';
        this.events.emit(Common.EVENT_EXEC_KILLED);
        Common.trace(Common.STATE_ERROR, `ジョブを強制終了しました。（execFile：${this.file}、PID：${this.process.pid}）`);
        this.process = undefined;
    }
}
