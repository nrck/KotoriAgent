import * as chai from 'chai';
import { ExecJob } from '../src/execJob';

describe('ExecJobクラスの単体テスト', () => {
    const exec1 = new ExecJob('100', '200', 'C:\\開発\\bat\\test.bat');
    exec1.events.on('ExecError', () => { console.log('on ExecError1'); });
    exec1.events.on('ExecSuccess', () => { console.log('on ExecSuccess1'); });

    const exec2 = new ExecJob('100', '200', 'C:\\開発\\bat\\test2.bat');
    exec1.events.on('ExecError', () => { console.log('on ExecError2'); });
    exec1.events.on('ExecSuccess', () => { console.log('on ExecSuccess2'); });

    it('ジョブの実行', () => {
        chai.assert.doesNotThrow(() => { exec1.exec(); });
    });

    it('ジョブの強制終了', () => {
        chai.assert.doesNotThrow(() => { exec2.exec(); });
        chai.assert.doesNotThrow(() => { exec2.kill(); });
    });

    it('すでに終了しているジョブの強制終了', () => {
        chai.assert.doesNotThrow(() => {
            setTimeout(() => { exec1.kill(); }, 3000);
        });
    });
});
