import SourcePlugin from 'neon-extension-framework/base/plugins/source';


export class NetflixPlugin extends SourcePlugin {
    constructor() {
        super('netflix');
    }
}

export default new NetflixPlugin();
