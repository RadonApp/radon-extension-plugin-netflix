import SyncService from 'neon-extension-framework/services/source/sync';
import Registry from 'neon-extension-framework/core/registry';

import Plugin from 'neon-extension-source-netflix/core/plugin';


export class NetflixSyncService extends SyncService {
    constructor() {
        super(Plugin);
    }
}

// Register service
Registry.registerService(new NetflixSyncService());
