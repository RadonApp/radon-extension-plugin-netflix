import ConfigurationService from 'eon.extension.framework/services/configuration';
import Registry from 'eon.extension.framework/core/registry';

import Plugin from 'eon.extension.source.netflix/core/plugin';
import Options from './options';


export class NetflixConfigurationService extends ConfigurationService {
    constructor() {
        super(Plugin, Options);
    }
}

// Register service
Registry.registerService(new NetflixConfigurationService());
