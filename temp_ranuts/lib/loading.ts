import 'ranui/loading';

export const showLoading = (): { removeLoading: () => void } => {
  const loading = document.createElement('r-loading');
  loading.setAttribute('name', 'circle');
  loading.setAttribute('size', 'large');
  loading.style.cssText = `
    color: #1890ff;
    font-size: 24px;
  `;

  const mask = document.createElement('div');
  mask.setAttribute('class', 'w-full h-full fixed top-0 left-0 bg-black/30 flex items-center justify-center');
  mask.style.cssText = `
    backdrop-filter: blur(2px);
    z-index: 10000;
  `;
  mask.appendChild(loading);
  document.body.appendChild(mask);
  return {
    removeLoading: () => {
      if (document.body?.contains(mask)) {
        document.body?.removeChild(mask);
      }
    },
  };
};
