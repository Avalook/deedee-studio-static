export function lazyLoadImagesAfter(html, eagerBudget = 45) {
  const budget = Math.max(0, Math.floor(Number(eagerBudget) || 0));
  let imageIndex = 0;

  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const currentIndex = imageIndex++;
    if (currentIndex < budget || /\bfetchpriority=["']high["']/i.test(tag)) return tag;

    if (/\bloading=["'][^"']*["']/i.test(tag)) {
      return tag.replace(/\bloading=["'][^"']*["']/i, 'loading="lazy"');
    }
    return tag.replace(/<img\b/i, '$& loading="lazy"');
  });
}


