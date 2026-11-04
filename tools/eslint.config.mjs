export default [{
  files: ['**/*.js'],
  languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: {
    window:'readonly',document:'readonly',chrome:'readonly',console:'readonly',fetch:'readonly',
    setTimeout:'readonly',clearTimeout:'readonly',URL:'readonly',Blob:'readonly',FileReader:'readonly',
    Audio:'readonly',Event:'readonly',CustomEvent:'readonly',KeyboardEvent:'readonly',MouseEvent:'readonly',
    PointerEvent:'readonly',HTMLTextAreaElement:'readonly',HTMLInputElement:'readonly',OscillatorNode:'readonly',
    AudioContext:'readonly',localStorage:'readonly',confirm:'readonly',getComputedStyle:'readonly',
    createImageBitmap:'readonly',OffscreenCanvas:'readonly',self:'readonly',navigator:'readonly',
    Promise:'readonly',requestAnimationFrame:'readonly',MutationObserver:'readonly',Math:'readonly',Date:'readonly'
  }},
  rules: { 'no-undef': 'error' }
}];
