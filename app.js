#!/usr/bin/env node
require('newrelic');

var Firebase = require('firebase'),
    http   = require('http'),
    fbutil   = require('./fbutil'),
    fburl = 'https://' + process.env.FB_NAME + '.firebaseio.com/',
    express = require('express'),
    app = express();


fbutil.auth(fburl, process.env.FB_TOKEN).done(function() {
   var  F = new Firebase(fburl), indexed = F.child("indexed");

   function index(key, data, indexref, tags, also_unindex){
      var index_name = indexref.name();
      tags.forEach(function(t){
         indexref.child(t).child(key).set(data);
         indexed.child(index_name).child(key).child(t).set(true);
      });
      if (also_unindex){
         // detect removed values
         indexed.child(index_name).child(key).once('value', function(snap){
            var val = snap.val();
            if (val){
              var indexed_values = Object.keys(val);
              var removed_values = indexed_values.filter(function(x) { return tags.indexOf(x) < 0 });
              removed_values.forEach(function(t){
                 indexref.child(t).child(key).remove();
                 indexed.child(index_name).child(key).child(t).remove();
              });              
            }
         });
      }
   }

   function observe_and_index(table_ref, map){
      table_ref.on('child_added', function(snap){
        var key = snap.name(), data = snap.val();
        for (var attribute in map){
           index(key, data, map[attribute], Object.keys(data[attribute]||{}), false);
        }
      });
      table_ref.on('child_changed', function(snap){
         var key = snap.name(), data = snap.val();
         for (var attribute in map){
           index(key, data, map[attribute], Object.keys(data[attribute]||{}), true);
         }
      }); 
      table_ref.on('child_removed', function(snap){
         var key = snap.name();
         for (var attribute in map){
            index(key, {}, map[attribute], [], true);
         }
      });
   }

   observe_and_index(F.child("users"), {
      lifestyles: F.child("users_by_lifestyle"),
      new_identities: F.child("users_by_new_goal"),
      old_identities: F.child("users_by_old_goal"),
      cities: F.child("users_by_city")
   });
   observe_and_index(F.child("lifestyles"), {
      cities: F.child("lifestyles_by_city")
   });
   observe_and_index(F.child("activities"), {
      lifestyles: F.child("activities_by_lifestyle"),
      websites:   F.child("activities_by_website"),
      identities: F.child("activities_by_identity")
   });


   // app part

   app.use(express.logger());
   app.use(express.static(__dirname));
   app.use(express.bodyParser());

   app.get('/url/:url', function(req, res){
      http.get(req.params.url, function(httpres) {
        console.log("Got response: " + httpres.statusCode);
        httpres.setEncoding('utf8');
        httpres.on('data', function (chunk) {
          var m = chunk.match(/<title>(.*)<\/title>/);
          if (m){
            res.send(JSON.stringify({
              url: req.params.url,
              title: m[1]
            }));            
          }
        });
      }).on('error', function(e) {
        console.log("Got error: " + e.message);
      });
   });

   // app.post('/:id/ping', function(req, res){
   //    if (req.body.did == 'scheduled'){
   //       main.child(req.params.id).child('schedct').transaction(function(count){
   //          if (count !== undefined) return count+1;
   //       }, function(err, committed, snap){
   //          res.send('Bumped');
   //       });
   //    }
   // });

   var port = process.env.PORT || 5000;
   app.listen(port, function() { console.log("Listening on " + port); });

});
