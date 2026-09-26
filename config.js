// ===== 設定 =====
// LIFF_IDS : LINE Developers「オクトーバーフェスト会場MAP」チャネル（LINEミニアプリ）の LIFF ID
//            エンドポイントURLの ?env=dev / review / prod で自動的に切り替わります
// GAS_URL  : スプレッドシート（【OKF】会場MAP LINEミニアプリ データ）の GAS ウェブアプリ URL
//            空ならリポジトリ内の data/fallback.json を表示
(function () {
  var LIFF_IDS = {
    dev:    '2011751942-pksgkYox',
    review: '2011751943-2rHT9SOB',
    prod:   '2011751944-EmLAJra7'
  };
  var env = new URLSearchParams(location.search).get('env') || 'prod';
  window.APP_CONFIG = {
    ENV: env,
    LIFF_ID: LIFF_IDS[env] || LIFF_IDS.prod,
    GAS_URL: 'https://script.google.com/macros/s/AKfycbxHEvEvNcs7XEH3YiKEaPHDWt6Imbt0AKiJ8F_Usc2BfwqE8wOvQgNF2YlMporu6gLb/exec',
    DEFAULT_VENUE: 'toyosu'
  };
})();
