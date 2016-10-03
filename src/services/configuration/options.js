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

        new CheckboxOption(Plugin, 'activity.movies', 'Movies', {
            default: true,
            requires: ['activity.enabled']
        }),

        new CheckboxOption(Plugin, 'activity.episodes', 'Episodes', {
            default: true,
            requires: ['activity.enabled']
        })
    ]),

    new Group(Plugin, 'sync', 'Sync', [
        new EnableOption(Plugin, 'sync.enabled', 'Enabled', {
            default: true,
            requires: ['enabled']
        }),

        new CheckboxOption(Plugin, 'sync.history', 'Watched history', {
            default: true,
            requires: ['sync.enabled']
        }),

        new CheckboxOption(Plugin, 'sync.ratings', 'Ratings', {
            default: true,
            requires: ['sync.enabled']
        })
    ])
];
