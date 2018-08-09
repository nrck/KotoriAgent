import { EventEmitter } from 'events';
import { Common } from './common';
import { ExecJob } from './execJob';
import { SerialJobJSON } from './interface';

export class ExecJobManager {
    private _execJobs = new Array<ExecJob>();
    private _events: EventEmitter = new EventEmitter();

    public get execJobs(): ExecJob[] {
        return this._execJobs;
    }

    public set execJobs(value: ExecJob[]) {
        this._execJobs = value;
    }

    public get events(): EventEmitter {
        return this._events;
    }

    /**
     * ExecJobの中からserialに一致するExecJobを返します。
     * @param serial 検索対象のシリアル番号
     */
    public findExecJob(serial: string): ExecJob | undefined {
        return this.execJobs.find((execJob: ExecJob) => execJob.serial === serial);
    }

    /**
     * ExecJobの中にserialに一致するExecJobが存在するか返します。
     * @param serial 検索対象のシリアル番号
     */
    public isExistExecJob(serial: string): boolean {
        const execJob = this.findExecJob(serial);

        return typeof execJob !== 'undefined';
    }

    /**
     * ジョブをリストに追加
     * @param serialJobJSON 受信したジョブ
     */
    public putExecJob(serialJobJSON: SerialJobJSON): boolean {
        // 既に同じserialのジョブが存在したら追加しない。
        if (this.isExistExecJob(serialJobJSON.serial)) return false;

        // ExecJobの作成
        const job = new ExecJob(serialJobJSON);

        // Eventはそのままパススルーするー（激寒）
        job.events.on(Common.EVENT_EXEC_ERROR, () => { this.onExecError(job); });
        job.events.on(Common.EVENT_EXEC_SUCCESS, (stdout: string, stderr: string) => { this.onExecSuccess(job, stdout, stderr); });
        job.events.on(Common.EVENT_EXEC_KILLED, () => { this.onExecKilled(job); });

        // リストに追加
        this.execJobs.push(job);

        return true;
    }

    /**
     * ジョブをリストから削除します。
     * @param serial 対象のシリアル番号
     */
    public delExecJob(serial: string): boolean {
        return this.execJobs.some((job: ExecJob, index: number) => {
            if (job.serial === serial) {
                this.execJobs.splice(index, 1);

                return true;
            } else {
                return false;
            }
        });
    }

    /**
     * 対象のジョブを実行します。
     * @param serial 対象のシリアル番号
     */
    public execJob(serial: string): boolean {
        const job = this.findExecJob(serial);
        if (typeof job === 'undefined') return false;
        job.exec();

        return true;
    }

    /**
     * 対象のジョブを強制終了します。
     * @param serial 対象のシリアル番号
     */
    public killJob(serial: string): boolean {
        const job = this.findExecJob(serial);
        if (typeof job === 'undefined') return false;
        job.kill();

        return true;
    }

    /**
     * ExecError発生時の処理です。
     * @param job 対象のジョブ
     */
    private onExecError(job: ExecJob): void {
        this.events.emit(Common.EVENT_EXEC_ERROR, job, (isSended: boolean) => {
            if (isSended) this.delExecJob(job.serial);
            else Common.trace(Common.STATE_ERROR, `シリアル：${job.serial}, ジョブコード${job.code}のError情報送信が受理されませんでした。`);
        });
    }

    /**
     * ExecSuccess発生時の処理です。
     * @param job 対象のジョブ
     * @param stdout 標準出力
     * @param stderr エラー出力
     */
    private onExecSuccess(job: ExecJob, stdout: string, stderr: string): void {
        this.events.emit(Common.EVENT_EXEC_SUCCESS, job, stdout, stderr, (isSended: boolean) => {
            if (isSended) this.delExecJob(job.serial);
            else Common.trace(Common.STATE_ERROR, `シリアル：${job.serial}, ジョブコード${job.code}のSuccess情報送信が受理されませんでした。`);
        });
    }

    /**
     * ExecKilled発生時の処理です。
     * @param job 対象のジョブ
     */
    private onExecKilled(job: ExecJob): void {
        this.events.emit(Common.EVENT_EXEC_KILLED, job, (isSended: boolean) => {
            if (isSended) this.delExecJob(job.serial);
            else Common.trace(Common.STATE_ERROR, `シリアル：${job.serial}, ジョブコード${job.code}のKilled情報送信が受理されませんでした。`);
        });
    }
}
