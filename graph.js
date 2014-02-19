var width = 960, height = 500;
var svg = d3.select("svg").attr("width", width).attr("height", height);

var force = d3.layout.force()
    .gravity(.06)
    .distance(50)
    .charge(-100)
    .size([width, height]);

var nodes = [], links = [], nodes_by_id = {}, links_by_id = {};
var link = svg.selectAll("path").data(links, function(l){ return l&&l.id; });
var node = svg.selectAll("g").data(nodes, function(l){ return l&&l.id; });
force.nodes(nodes).links(links);


force.on("tick", function() {
  // draw directed edges with proper padding from node centers
  svg.selectAll("path.link").attr('d', function(d) {
  	if (!d || !d.target || !d.source || !d.source.x || !d.target.x) return 'M0,0L100,100';
    var deltaX = d.target.x - d.source.x,
        deltaY = d.target.y - d.source.y,
        dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
        normX = deltaX / dist,
        normY = deltaY / dist,
        sourcePadding = 8,
        targetPadding = 11,
        sourceX = d.source.x + (sourcePadding * normX),
        sourceY = d.source.y + (sourcePadding * normY),
        targetX = d.target.x - (targetPadding * normX),
        targetY = d.target.y - (targetPadding * normY);
    return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
  });

  svg.selectAll("g").attr("transform", function(d) { if (d) return "translate(" + d.x + "," + d.y + ")"; });
});



function make_node(new_node){
    new_node.attr("class", "node");
    new_node.append("circle")
        .attr("x", 0)
        .attr("y", 0)
        .attr("r", 8)  
    new_node.append("text")
        .attr("dx", 12)
        .attr("dy", ".35em")
        .text(function(d) { return d.name });
    // new_node.append("text")
    //     .attr("class", "info")
    //     .attr("dx", 12)
    //     .attr("dy", "1.35em")
    //     .text(function(d) { return d.desires.join('/'); }); // + ' ' + (d.lifestyles||[]).join(',');
};



function goto_activities_graph(){
    reveal('graph');
    F.child('activities').once('value', function(snap) { build_activities_graph(snap.val()); });
}

function build_activities_graph(got_nodes){
	for (var node_id in got_nodes){
		var n = got_nodes[node_id];
		if (!nodes_by_id[node_id]){
			n.id = node_id;
			nodes.push(n);
			nodes_by_id[node_id] = n;
		}
	}

	for (var node_id in nodes_by_id){
		var n = nodes_by_id[node_id];
		if (n.preferred){
			Object.keys(n.preferred).forEach(function(desire){
                Object.keys(n.preferred[desire]).forEach(function(better_activity_id){
                    var left, right;
                    if (better_activity_id > node_id){ left = node_id; right = better_activity_id }
                    else { left = better_activity_id; right = node_id };

                    var link_id = left + '::' + right;
                    var l = links_by_id[link_id];
                    if (!l){
                        l = links_by_id[link_id] = { id: link_id, left: left, right: right, left_better_count: 0, right_better_count: 0 };
                        links.push(l);
                    }

                    if (better_activity_id == left) l.left_better_count += 1;
                    else l.right_better_count += 1;

                    if (l.left_better_count > l.right_better_count){
                        l.source = nodes_by_id[l.right];
                        l.target = nodes_by_id[l.left];
                    } else {
                        l.source = nodes_by_id[l.left];
                        l.target = nodes_by_id[l.right];
                    }
                });
			});
		}
	}

    console.log(links);

    link.data(links, function(l){ return l.id; })
      .enter().append("path")
        .attr("class", "link");
  
    node.data(nodes, function(n){ return n.id; })
      .enter().append("g")
        .call(force.drag)
        .call(make_node);
  
    force.start();
};
