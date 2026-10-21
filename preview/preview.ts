/**
 * 独立场景预览：复用真实 scene.ts，不包含聊天或设置业务。
 * 用于检查构图、昼夜与农人动作；真实主题运行在 DSH 界面内。
 */
import { computeScene, createSceneView } from '../src/scene';

const stage = document.querySelector<HTMLElement>('#stage');
if (!stage) throw new Error('missing #stage');
const clock = document.querySelector<HTMLOutputElement>('#clock');
const periodLabel = document.querySelector<HTMLElement>('#period');
const slider = document.querySelector<HTMLInputElement>('#hour');
const ambient = document.querySelector<HTMLInputElement>('#ambient');
const reduced = document.querySelector<HTMLInputElement>('#reduced');
const farmer = document.querySelector<HTMLInputElement>('#farmer');
const working = document.querySelector<HTMLInputElement>('#thinking');

const media = window.matchMedia('(prefers-reduced-motion: reduce)');
let hour = 12.5;
let ambientOn = !media.matches;
let reducedOn = media.matches;

const view = createSceneView(stage, { reducedMotion: reducedOn, ambient: ambientOn });
const render = (): void => {
  const time = computeScene(hour);
  view.apply(time);
  view.setViewBox(stage.clientWidth, stage.clientHeight);
  if (clock) clock.textContent = `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}`;
  if (periodLabel) periodLabel.textContent = { dawn: '晨光', day: '晴昼', dusk: '黄昏', night: '静夜' }[time.period];
};
const syncInputs = (): void => {
  if (slider) slider.value = String(hour);
  if (ambient) ambient.checked = ambientOn;
  if (reduced) reduced.checked = reducedOn;
};

slider?.addEventListener('input', () => {
  hour = Number(slider.value);
  render();
});
document.querySelectorAll<HTMLButtonElement>('[data-hour]').forEach(button => {
  button.addEventListener('click', () => {
    hour = Number(button.dataset.hour ?? hour);
    syncInputs();
    render();
  });
});
ambient?.addEventListener('change', () => {
  ambientOn = ambient.checked;
  view.setMotion({ reducedMotion: reducedOn, ambient: ambientOn });
});
reduced?.addEventListener('change', () => {
  reducedOn = reduced.checked;
  view.setMotion({ reducedMotion: reducedOn, ambient: ambientOn });
});
farmer?.addEventListener('change', () => view.setFarmerEnabled(farmer.checked));
working?.addEventListener('change', () => {
  view.setFarmerEnabled(farmer?.checked !== false);
  view.setFarmerWorking(working.checked);
});
window.addEventListener('resize', () => view.setViewBox(stage.clientWidth, stage.clientHeight));
media.addEventListener('change', event => {
  reducedOn = event.matches;
  if (reduced) reduced.checked = reducedOn;
  view.setMotion({ reducedMotion: reducedOn, ambient: ambientOn });
});

syncInputs();
render();
