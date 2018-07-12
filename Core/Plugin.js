import SourcePlugin from '@radon-extension/framework/Models/Plugin/Source';


export class NetflixPlugin extends SourcePlugin {
    constructor() {
        super('netflix');
    }
}

export default new NetflixPlugin();
