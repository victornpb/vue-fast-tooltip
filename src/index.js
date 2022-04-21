import directive from './v-tooltip';
const DIRECTIVE = 'tooltip';

const plugin = {
  name: DIRECTIVE,
  install(Vue, installOptions) {
    Vue.directive(DIRECTIVE, directive);
  },
  directive,
};

export default plugin;
