const PET_ADOPT_PREVIEWS: Record<string, string> = {
  requested: '[\u5171\u540c\u5ba0\u7269] \u5171\u540c\u9886\u517b\u9080\u8bf7',
  accepted: '[\u5171\u540c\u5ba0\u7269] \u5df2\u540c\u610f\u5171\u540c\u9886\u517b',
  rejected: '[\u5171\u540c\u5ba0\u7269] \u5df2\u62d2\u7edd\u5171\u540c\u9886\u517b',
};

function petAdoptPreview(content: string) {
  try {
    const event = JSON.parse(content)?.event;
    return PET_ADOPT_PREVIEWS[event] || '[\u5171\u540c\u5ba0\u7269]';
  } catch {
    return '[\u5171\u540c\u5ba0\u7269]';
  }
}

export function messagePreview(type: string, content = '', maxLength = Number.POSITIVE_INFINITY) {
  let preview = content;
  if (type === 'image') preview = '[\u56fe\u7247]';
  if (type === 'voice') preview = '[\u8bed\u97f3]';
  if (type === 'video') preview = '[\u89c6\u9891]';
  if (type === 'call') preview = content || '[\u901a\u8bdd]';
  if (type === 'pet-adopt') preview = petAdoptPreview(content);
  return preview.length > maxLength ? `${preview.slice(0, maxLength)}...` : preview;
}
