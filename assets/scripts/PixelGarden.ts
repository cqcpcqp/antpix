import { _decorator, Component } from 'cc';
import { GardenRuntime } from './app/GardenRuntime';
const { ccclass } = _decorator;

/** Scene-bound adapter. Keep this class name and its .meta UUID stable. */
@ccclass('PixelGarden')
export class PixelGarden extends Component {
    readonly runtime = new GardenRuntime(this);
    onLoad() {
        this.runtime.lifecycle.onLoad();
    }
    onDestroy() {
        this.runtime.lifecycle.onDestroy();
    }
    update(dt: number) {
        this.runtime.loop.update(dt);
    }
}
