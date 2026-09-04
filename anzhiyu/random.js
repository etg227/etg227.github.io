var posts=["/notes/welcome/","/projects/kubernetes-isekai/"];function toRandomPost(){
    window.location.href='/'+posts[Math.floor(Math.random() * posts.length)];
  };