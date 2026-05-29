var posts=["2025/04/20/post/","2025/01/14/hello-world/","2025/04/20/test/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };