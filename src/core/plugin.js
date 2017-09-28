import SourcePlugin from 'neon-extension-framework/base/plugins/source';

import Manifest from '../../module.json';


export class NetflixPlugin extends SourcePlugin {
    constructor() {
        super('netflix', Manifest);
    }
}

export default new NetflixPlugin();
