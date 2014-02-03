#!/usr/bin/env node
require('newrelic');

var Firebase = require('firebase'),
    fbutil   = require('./fbutil'),
    fburl = 'https://' + process.env.FB_NAME + '.firebaseio.com/',
    express = require('express'),
    app = express();


fbutil.auth(fburl, process.env.FB_TOKEN).done(function() {
   var  F = new Firebase(fburl),
        activities = F.child("activities"),
        activities_by_lifestyle = F.child("activities_by_lifestyle"),
        activities_by_desire    = F.child("activities_by_desire"),
        activities_by_identity  = F.child("activities_by_identity"),
        activities_by_city      = F.child("activities_by_city"),
        indexed = F.child("indexed");

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

   activities.on('child_added', function(snap){
      var key = snap.name(), data = snap.val();
      index(key, data, activities_by_desire, data.desires || [], false);
      index(key, data, activities_by_lifestyle, data.lifestyles || [], false);
      index(key, data, activities_by_identity, data.identities || [], false);
      index(key, data, activities_by_city, data.cities || [], false);
   });

   activities.on('child_changed', function(snap){
      var key = snap.name(), data = snap.val();
      index(key, data, activities_by_desire, data.desires || [], true);
      index(key, data, activities_by_lifestyle, data.lifestyles || [], true);
      index(key, data, activities_by_identity, data.identities || [], true);
      index(key, data, activities_by_city, data.cities || [], true);
   });

   activities.on('child_removed', function(snap){
      var key = snap.name();
      index(key, {}, activities_by_desire, [], true);
      index(key, {}, activities_by_lifestyle, [], true);
      index(key, {}, activities_by_identity, [], true);
      index(key, {}, activities_by_city, [], true);
      // itags.child(key).remove();
   });


   // app part

   app.use(express.logger());
   app.use(express.static(__dirname));
   app.use(express.bodyParser());

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
