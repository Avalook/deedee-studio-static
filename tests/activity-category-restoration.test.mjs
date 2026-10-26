import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Activity category restores archived posts only when route and thumbnail are present', async () => {
  const html = await readFile(new URL('../blog/categories/hoạt-động/index.html', import.meta.url), 'utf8');
  const cards = [
    {
      title: 'DeeDee Trip (2020)',
      href: '/deedee-studio-static/post/deedee-trip-2020/',
      image: '/deedee-studio-static/assets/wix-437529_2ba89c05b66843299c1f99cb689312e8~mv2.jpg',
    },
    {
      title: 'A Visiting From Mr. Frederic Alliod (2020)',
      href: '/deedee-studio-static/post/a-visiting-from-mr-frederic-alliod-2020/',
      image: '/deedee-studio-static/assets/wix-437529_19f508538afa4971989efbb785d882df~mv2.jpg',
    },
    {
      title: 'A Visiting From Mr. Daniel Santos - Director of Sales - EMEA & APAC Of Toon Boom (2020)',
      href: '/deedee-studio-static/post/a-visiting-from-mr-daniel-santos-director-of-sales-emea-apac-of-toon-boom-2020/',
      image: '/deedee-studio-static/assets/c5cd72d254965931c94fd959.png',
    },
    {
      title: 'Golden Kite Film Festival (2019)',
      href: '/deedee-studio-static/post/golden-kite-film-festival-2019-2/',
      image: '/deedee-studio-static/assets/23ee25b7776eea5b2fbea072.jpg',
    },
    {
      title: 'DeeDee Animation Studio - Khởi Nghiệp Animation: Đi Đi Rồi Sẽ Đến',
      href: '/deedee-studio-static/post/khoi-nghiep-animation/',
      image: '/deedee-studio-static/assets/bfcf010abdc3df9213decd37.jpg',
    },
    {
      title: 'Series Hoạt Hình Việt "Biệt Đội iOn Bạc" - Kỷ Niệm 1 Năm',
      href: '/deedee-studio-static/post/series-hoat-hinh-viet/',
      image: '/deedee-studio-static/assets/7b0bd4d257b26ecf2f60be31.jpg',
    },
    {
      title: 'DeeDee x MACC: Master Class With Anime Director Ito Tomohiko (2020)',
      href: '/deedee-studio-static/post/deedee-x-macc-master-class-with-anime-director-ito-tomohiko-2020/',
      image: '/deedee-studio-static/assets/wix-437529_a911e9c0725f434f99fd1ac32e989a0a~mv2.png',
    },
    {
      title: 'A Visiting From Mr. Phạm Quang Vinh - Director Of Kim Dong Publishing House (2020)',
      href: '/deedee-studio-static/post/a-visiting-from-mr-ph%E1%BA%A1m-quang-vinh-director-of-kim-dong-publishing-house-2020/',
      image: '/deedee-studio-static/assets/wix-437529_41be6f08c15f4187a18f5a9b876a9c2d~mv2.png',
    },
    {
      title: 'DeeDee Attended Asia TV Forum & Market (2019)',
      href: '/deedee-studio-static/post/deedee-attended-asia-tv-forum-market-2019/',
      image: '/deedee-studio-static/assets/wix-437529_3e70f762109445a487994dc58f7b9f47~mv2.png',
    },
    {
      title: '21st Viet Nam Film Festival (2019)',
      href: '/deedee-studio-static/post/21st-viet-nam-film-festival-2019/',
      image: '/deedee-studio-static/assets/wix-437529_b00ae6398eff4a2f9b825bfef9468f75~mv2.png',
    },
  ];

  const gallery = html.match(/id="pro-gallery-margin-container-pro-blog"[\s\S]*?data-key="items-styles"/)?.[0];

  assert.ok(gallery, 'the category gallery markup is present');
  assert.equal((gallery.match(/data-hook="item-link-wrapper"/g) ?? []).length, 50, 'the gallery contains all 50 source archive cards');

  const escapeHtml = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

  for (const card of cards) {
    assert.ok(html.includes(`href="${card.href}"`), `${card.title} links to its archived route`);
    assert.ok(html.includes(`alt="${escapeHtml(card.title)}"`), `${card.title} keeps the source image alternative text`);
    assert.ok(html.includes(`>${escapeHtml(card.title)}</h2>`), `${card.title} keeps the source title`);
    assert.ok(html.includes(`src="${card.image}"`), `${card.title} uses its exact archived thumbnail asset`);
  }
});
