// Source logo mapping for various websites and services
export const getSourceLogo = (url: string): string | null => {
  try {
    const domain = new URL(url).hostname.toLowerCase().replace('www.', '')
    
    // Map of domain patterns to logo URLs
    const logoMap: Record<string, string> = {
      // Sports
      'espn.com': 'https://a.espncdn.com/i/espn/misc_logos/500/espn.png',
      'foxsports.com': 'https://b.fssta.com/uploads/application/wwe/icon-download-new/FS1.png',
      'nba.com': 'https://cdn.nba.com/logos/leagues/logo-nba.svg',
      'nfl.com': 'https://static.www.nfl.com/image/upload/v1554321393/league/nvfr7ogywskqrfaiu38m.svg',
      'mlb.com': 'https://www.mlb.com/mlb-com-cms-logos/mlb-logo.svg',
      
      // Tech companies
      'openai.com': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/OpenAI_Logo.svg/512px-OpenAI_Logo.svg.png',
      'anthropic.com': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Anthropic_logo.svg/512px-Anthropic_logo.svg.png',
      'google.com': 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png',
      'microsoft.com': 'https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RE1Mu3b?ver=5c31',
      'apple.com': 'https://www.apple.com/ac/structured-data/images/knowledge_graph_logo.png',
      'github.com': 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
      
      // News
      'cnn.com': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/CNN_International_logo.svg/512px-CNN_International_logo.svg.png',
      'bbc.com': 'https://static.bbci.co.uk/ws/simorgh-assets/public/bbc-logo.png',
      'bbc.co.uk': 'https://static.bbci.co.uk/ws/simorgh-assets/public/bbc-logo.png',
      'reuters.com': 'https://www.reuters.com/pf/resources/images/reuters/logo-vertical-default.png',
      'nytimes.com': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/NewYorkTimes.svg/512px-NewYorkTimes.svg.png',
      'washingtonpost.com': 'https://www.washingtonpost.com/pb/resources/img/twp-social-share.png',
      'theguardian.com': 'https://assets.guim.co.uk/images/guardian-logo-rss.c45beb1bafa34b347ac333af2e6fe23f.png',
      'forbes.com': 'https://i.forbesimg.com/media/assets/forbes_1200x1200.jpg',
      'bloomberg.com': 'https://assets.bbhub.io/company/sites/51/2019/08/og-image-default-bloomberg.png',
      'wsj.com': 'https://s.wsj.net/img/meta/wsj-social-share.png',
      'techcrunch.com': 'https://techcrunch.com/wp-content/uploads/2015/02/cropped-cropped-favicon-gradient.png',
      'theverge.com': 'https://cdn.vox-cdn.com/uploads/chorus_asset/file/7395359/verge-social-share.png',
      'wired.com': 'https://www.wired.com/verso/static/wired/assets/favicon.ico',
      
      // Social Media / Platforms
      'youtube.com': 'https://www.youtube.com/s/desktop/2f7c8d96/img/favicon_144x144.png',
      'twitter.com': 'https://abs.twimg.com/responsive-web/client-web/icon-ios.77d25eba.png',
      'x.com': 'https://abs.twimg.com/responsive-web/client-web/icon-ios.77d25eba.png',
      'facebook.com': 'https://static.xx.fbcdn.net/rsrc.php/yb/r/hLRJ1GG_y0J.ico',
      'instagram.com': 'https://static.cdninstagram.com/rsrc.php/v3/yG/r/De-Dwpd5CHc.png',
      'reddit.com': 'https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-180x180.png',
      'linkedin.com': 'https://static.licdn.com/aero-v1/sc/h/al2o9zrvru7aqj8e1x2rzsrca',
      'tiktok.com': 'https://lf16-tiktok-common.ttwstatic.com/obj/tiktok-web-common-sg/mtact/static/images/share_img.png',
      
      // Tech/Dev
      'stackoverflow.com': 'https://cdn.sstatic.net/Sites/stackoverflow/Img/apple-touch-icon.png',
      'medium.com': 'https://miro.medium.com/max/1200/1*sHhtYhaCe2Uc3IU0IgKwIQ.png',
      'dev.to': 'https://res.cloudinary.com/practicaldev/image/fetch/s--t7tVouP9--/c_limit%2Cf_png%2Cfl_progressive%2Cq_80%2Cw_192/https://practicaldev-herokuapp-com.freetls.fastly.net/assets/devlogo-pwa-512.png',
      
      // Other
      'wikipedia.org': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Wikipedia\'s_W.svg/512px-Wikipedia\'s_W.svg.png',
      'amazon.com': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Amazon_logo.svg/512px-Amazon_logo.svg.png',
      'investopedia.com': 'https://www.investopedia.com/thmb/QI_bhwJB9D0SOySvBCLZAekO0Kc=/192x192/filters:no_upscale():max_bytes(150000):strip_icc()/apple-touch-icon-ed251c3336034d808fdee78fb6ef3ebc.png',
      'the-independent.com': 'https://static.independent.co.uk/2021/04/26/09/logo-icon-512x512.png',
      'independent.co.uk': 'https://static.independent.co.uk/2021/04/26/09/logo-icon-512x512.png',
    }
    
    // Check for exact domain match first
    if (logoMap[domain]) {
      return logoMap[domain]
    }
    
    // Check for partial matches (e.g., subdomains)
    for (const [key, value] of Object.entries(logoMap)) {
      if (domain.includes(key) || key.includes(domain)) {
        return value
      }
    }
    
    // Generate a fallback using favicon service
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  } catch (error) {
    console.error('Error getting source logo:', error)
    return null
  }
}
