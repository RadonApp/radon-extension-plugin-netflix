import SourcePlugin from 'eon.extension.framework/base/plugins/source';


export class NetflixPlugin extends SourcePlugin {
    constructor() {
        super('netflix', 'Netflix');
    }
}

export default new NetflixPlugin();
