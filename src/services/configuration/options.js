import {
    CheckboxOption,
    EnableOption,
    Group
} from 'eon.extension.framework/services/configuration/models';

import Plugin from '../../core/plugin';


export default [
    new EnableOption(Plugin, 'enabled', 'Enabled', {
        default: false
    }),

    new Group(Plugin, 'activity', 'Activity', [
        new EnableOption(Plugin, 'activity.enabled', 'Enabled', {
            default: true,
            requires: ['enabled']
        }),
    ]),

    new Group(Plugin, 'sync', 'Sync', [
        new EnableOption(Plugin, 'sync.enabled', 'Enabled', {
            default: true,
            requires: ['enabled']
        }),

        new CheckboxOption(Plugin, 'sync.history', 'Synchronize watched history', {
            summary: 'Synchronize watched history with your enabled destinations',
            default: true,
            requires: ['sync.enabled']
        }),

        new CheckboxOption(Plugin, 'sync.ratings', 'Synchronize ratings', {
            summary: 'Synchronize ratings with your enabled destinations',
            default: true,
            requires: ['sync.enabled']
        })
    ])
];
