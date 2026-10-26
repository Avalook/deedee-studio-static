/* Restores the Wix video player on project routes whose markup was mirrored as an empty div.
   Sources are limited to embeds verified in the live Wix DOM, one entry per route. */
export const VERIFIED_PLAYERS = [
  {
    route: '/freefirehack',
    containerId: 'comp-l9pb1lco4',
    src: 'https://www.youtube.com/embed/I8aDHqsLAGE',
    title: 'NÊN LÀM GÌ KHI GẶP HACK? | GARENA FREE FIRE',
  },
  {
    route: '/en/freefirehack',
    containerId: 'comp-l9pb1lco4',
    src: 'https://www.youtube.com/embed/I8aDHqsLAGE',
    title: 'NÊN LÀM GÌ KHI GẶP HACK? | GARENA FREE FIRE',
  },
  {
    route: '/all-project/let-victory-make-history',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/IZis5cqW0dM',
    title: 'LET VICTORY MAKE HISTORY - @RhymasticOfficial ft. GDucky | Bài hát chủ đề AIC 2020',
  },
  {
    route: '/all-project/miracle-dirt',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/WbgEB9lFyE0',
    title: 'Đức Phúc - Lấm Lem Diệu Kỳ (feat. Hà Anh) (Official Music Video)',
  },
  {
    route: '/all-project/student-with-cyber-security',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/lLinvJDgln0',
    title: 'Cuộc thi Học sinh với ATTT 2022',
  },
  {
    route: '/en/all-project/okaimono-panda',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/rWW2nZ60NYA',
    title: 'アニメ『お買いものパンダ！』ノンテロップオープニング映像│毎週水曜21時54分～ TOKYO MXにて好評放送・配信中！',
  },
  {
    route: '/en/all-project/protecting-kids-on-the-internet',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/Zsfrgmdh6wg',
    title: 'Bảo vệ trẻ em trên mạng (Cục ATTT - JICA)',
  },
  {
    route: '/en/all-project/she-kings',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/Jf9iv_zblTc',
    title: '[C18] NỮ TƯỚNG CỦA HAI BÀ TRƯNG | Phim hành động hoạt hình lịch sử Việt Nam - Tập 01/6',
  },
  {
    route: '/en/all-project/student-with-cyber-security',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/lLinvJDgln0',
    title: 'Cuộc thi Học sinh với ATTT 2022',
  },
  {
    route: '/en/all-project/super-artist',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/-ZJIYKwg2qE',
    title: 'Super Artist - Siêu họa sỹ',
  },
  {
    route: '/en/all-project/susu-hero',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/Ez6LMA-j8yU',
    title: 'PHIM HOẠT HÌNH TẬP 2 – SUSU HERO HỢP LỰC HÀNH ĐỘNG , GIỮ TRÁI ĐẤT XANH',
  },
  {
    route: '/en/all-project/the-2021-year-end-offer',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/B71E57Z-QBQ',
    title: 'KHUYẾN MÃI CUỐI NĂM 2021',
  },
  {
    route: '/en/all-project/the-archmage-legacy',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/qMqR4HGDnSU',
    title: 'The Archmage Legacy ✨ Animated Preview',
  },
  {
    route: '/en/all-project/the-hero',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/BbRmYUgLF4I',
    title: '[ĐẠI HIỆP] TẬP 1: CAO ĐAO | DeeDee Animation Studio',
  },
  {
    route: '/en/all-project/the-legend-of-hai-moc-nhi',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/r5DjMbL9jIk',
    title: 'Hải Mộc Nhi',
  },
  {
    route: '/en/all-project/the-naugh-nice-business',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/qTA9d3Gm7ts',
    title: 'DỊCH VỤ QUỶ SỨ | TẬP 1 - Hoạt hình châm biếm - DeeDee Animation Studio',
  },
  {
    route: '/en/all-project/the-olive-treehouse',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/qC8tCuWjohg',
    title: 'Olive Treehouse: Feast of Tabernacles',
  },
  {
    route: '/en/all-project/the-silver-ion-squad',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/MUXX38MaQCk',
    title: 'Biệt Đội Ion Bạc Tập 1 - Vũ Trụ Đang Cần Bạn - Hoạt Hình Siêu Nhân Tiếng Việt',
  },
  {
    route: '/en/all-project/tied-up',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/2VqZJZB9a2s',
    title: 'Tied Up l Official Trailer 2026 l Available On Apple TV, Prime Video, Google Play, And Fandango l',
  },
  {
    route: '/en/all-project/usual-morning',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/LtdM7A0KzUI',
    title: 'VŨ CÁT TƯỜNG - BUỔI SÁNG BÌNH THƯỜNG (ft. HOÀNG PHONG)',
  },
  {
    route: '/en/all-project/vf3-sáng-tạo-chất-riêng',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/TfP5RysL6tc',
    title: 'VF3 - Animated Commercial - DeeDee Animation Studio',
  },
  {
    route: '/en/all-project/vim-super-heroes',
    containerId: 'comp-mtcnqx5k',
    src: 'https://www.youtube.com/embed/_sjbDfHS180',
    title: 'SẠCH KHUẨN HỌC ĐƯỜNG - CHUẨN ANH HÙNG VIM',
  },
  {
    route: '/en/all-project/planting-home-for-all-species',
    containerId: 'comp-mtcnqx5k',
    src: 'https://player.vimeo.com/video/768002424',
    title: '​Planting Homes For All Species | DeeDee Animation Studio',
  },
  {
    route: '/en/all-project/probi-guardian',
    containerId: 'comp-mtcnqx5k',
    src: 'https://player.vimeo.com/video/1222021822',
    title: 'HOẠT HÌNH VỆ SĨ PROBI ĐÁNH TAN ZOMBIE BỆNH VẶT - TẬP 2 - NGÀY HỘI THỂ THAO ĐÁNG NHỚ',
  },
  {
    route: '/en/all-project/pudgy-penguins',
    containerId: 'comp-mtcnqx5k',
    src: 'https://player.vimeo.com/video/1008300190',
    title: 'From Penguin Paradise to Asia: The Pudgy Penguins’ Grand Tour Begins!',
  },
  {
    route: '/en/all-project/strong-vietnam',
    containerId: 'comp-mtcnqx5k',
    src: 'https://player.vimeo.com/video/369276546',
    title: 'STRONG VIETNAM | Animated Viral Video - DeeDee Animation Studio',
  },
];

const EMBED_HOSTS = new Set(['www.youtube.com', 'player.vimeo.com']);
const EMBED_PATHS = new Map([
  ['www.youtube.com', /^\/embed\/[\w-]+$/],
  ['player.vimeo.com', /^\/video\/\d+$/],
]);
const ALLOW = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share';

export function normalizePageRoute(pathname) {
  let route = String(pathname || '/').replace(/^\/deedee-studio-static(?=\/|$)/, '').replace(/\/$/, '') || '/';
  try {
    route = decodeURI(route);
  } catch {
    /* Keep a malformed encoded path stable so it simply matches no player. */
  }
  return route;
}

export function createEmbedFrame(doc, player) {
  let url;
  try {
    url = new URL(player.src);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !EMBED_HOSTS.has(url.hostname)) return null;
  if (!EMBED_PATHS.get(url.hostname)?.test(url.pathname)) return null;

  const frame = doc.createElement('iframe');
  frame.setAttribute('src', url.href);
  frame.setAttribute('title', player.title);
  frame.setAttribute('allow', ALLOW);
  frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  frame.setAttribute('width', '100%');
  frame.setAttribute('height', '100%');
  frame.style.display = 'block';
  frame.style.position = 'absolute';
  frame.style.inset = '0px';
  frame.style.width = '100%';
  frame.style.height = '100%';
  frame.style.border = '0';
  return frame;
}

export function installProjectVideoPlayer(doc = document, pathname = typeof location === 'undefined' ? '/' : location.pathname) {
  const route = normalizePageRoute(pathname);
  for (const player of VERIFIED_PLAYERS) {
    if (player.route !== route) continue;
    const container = doc.getElementById(player.containerId);
    if (!container) continue;
    const frame = createEmbedFrame(doc, player);
    if (!frame) continue;
    container.style.position = 'relative';
    container.replaceChildren(frame);
  }
}

if (typeof document !== 'undefined') installProjectVideoPlayer();
