import ConfigurationService from 'neon-extension-framework/services/configuration';
import Registry from 'neon-extension-framework/core/registry';

import Plugin from 'neon-extension-source-netflix/core/plugin';
import Options from './options';


export class NetflixConfigurationService extends ConfigurationService {
    constructor() {
        super(Plugin, Options);
    }
}

// Register service
Registry.registerService(new NetflixConfigurationService());
