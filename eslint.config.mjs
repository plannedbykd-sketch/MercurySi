import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'crates/**/*', 'android-liquid-aar/**/*', 'ios-liquid-kit/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
