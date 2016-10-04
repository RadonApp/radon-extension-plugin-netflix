import SourcePlugin from 'eon.extension.framework/base/plugins/source';

import Manifest from '../../manifest.json';


export class NetflixPlugin extends SourcePlugin {
    constructor() {
        super('netflix', 'Netflix', Manifest);
    }
}

export default new NetflixPlugin();
