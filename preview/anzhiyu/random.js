var posts=["2026/09/17/wuwa-echo-methodology/", "2025/04/20/test/"];function toRandomPost(){
    pjax.loadUrl('/preview/'+posts[Math.floor(Math.random() * posts.length)]);
  };