import OptionsService from 'eon.extension.framework/base/services/source/activity';
import Registry from 'eon.extension.framework/core/registry';

import Plugin from '../../core/plugin';
import Options from './options';


export class NetflixOptionsService extends OptionsService {
    constructor() {
        super(Plugin, Options);
    }
}

// Register service
Registry.registerService(new NetflixOptionsService());
