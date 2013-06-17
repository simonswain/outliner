/*global Backbone:true,  _:true, $:true, App:true */
/*jshint browser:true */
/*jshint strict:false */

$(function(){
  App.start();
});

Backbone.View.prototype.close = function(){
  if (this.onClose){
    this.onClose();
  }
  this.remove();
};

var App = {
  self: this,
  Models: {},
  Collections: {},
  Views: {},
  layout: {},
  router: null,
  outline: null,  
  start: function(){
    this.init();
  },
  init: function() {

    this.outline = new App.Models.Outline();
    this.layout = {
      outline: new App.Views.Outline({
        el: $('.app'),
        model:this.outline
      })
    };
  }
};

App.Models.Node = Backbone.Model.extend({
  defaults: { 
    'id':null,
    'text':'',
    'outline': null,
    'collection': null, // node belongs to this collection
    'nodes': null // this node's children
  },
  initialize: function(opts) {
    console.log('create node');
    this.set({
      'nodes': new App.Collections.Nodes()
    });
    this.get('nodes').node = this;
  }
});


App.Collections.Nodes = Backbone.Collection.extend({
  model: App.Models.Node,
  initialize: function(opts) { 
  }
});


App.Models.Outline = Backbone.Model.extend({
  defaults: {
    'title': 'New Outline',
    'nodes': null,
    'focused': null
  },
  initialize: function(opts) { 
    console.log('create outline');
    _.bindAll(this, 'addNode');
    this.set('nodes', new App.Collections.Nodes());
    this.get('nodes').add({
      outline: this,
      collection: this.get('nodes'),
      text:'', 
      focused: true
    });
    this.set('focused', this.get('nodes').first());
  },  
  focusIndex: function(){
    var self = this;
    var focused = this.get('focused');
    var collection = focused.get('collection');
    if(collection.length === 1){
      return 0;
    }
    var ix = 0;
    collection.find(function(x, i){
      if(x.cid === focused.cid){
        ix = i;
        return true;
      }
    });
    return ix;
  },
  focus: function(node){
    this.set('focused', node);
  },
  addNode: function(){
    var self = this;
    var focused = this.get('focused');
    var collection = focused.get('collection');
    var ix = collection.length;
    collection.find(function(x, i){
      if(x.cid === focused.cid){
        ix = i;
        return true;
      }
    });
    var model = new App.Models.Node({
      outline: this,
      collection: collection,
      text:''
    });
    this.focus(model);
    collection.add(model,{at: ix + 1});
  },
  deleteNode: function(){
    var self = this;
    var focused = this.get('focused');
    var collection = focused.get('collection');
    if(collection.length === 1){
      return
    }
    var prev = collection.first();
    var target = false;
    collection.find(function(x, i){
      if(x.cid === focused.cid){
        collection.remove(x);
        // length === 0, remove collection
        self.focus(prev);
        return true;
      }
      prev = x;
      return false;
    });
  },
  deleteNextNode: function(){
    var self = this;
    var focused = this.get('focused');
    var collection = focused.get('collection');
    if(collection.length === 1){
      return
    }
    var found = false;
    collection.find(function(x, i){
      if(found){
        collection.remove(x);
        self.trigger('change');
        return true;
      }
        
      if(x.cid === focused.cid){
        found = true;
      }
      return false;
    });
  },
  promote: function(){

  },
  demote: function(){
    var ix = this.focusIndex();
    if(ix === 0){
      return;
    }
    var focused = this.get('focused');
    var collection = focused.get('collection');
    var target = collection.at(ix-1);
    var node = collection.at(ix);
    collection.remove(node);
    target.get('nodes').add(node);
    node.set('collection', target.get('nodes'));
    this.trigger('change');
  },
  up: function(fromNode){

    var self = this;
    var collection = fromNode.get('collection');

    // find this node's index
    var ix = 0;
    collection.find(function(x, i){
      if(x.cid === fromNode.cid){
        ix = i;
        return true;
      }
    });
    
    // at top of outline
    if(ix === 0 && ! collection.node){
      return fromNode;
    }
    
    // at top of sub-outline. go to parent node
    if(ix === 0){
      return collection.node;
    }

    // find previous sibling
    var node = collection.first();
    collection.find(function(x, i){
      if(x.cid === fromNode.cid){
        return true;
      }
      node = x;
      return false;
    });

    // descend to last child of outline
    while (node.get('nodes').length > 0){
      node = node.get('nodes').last();
    }
    
    return node;

  },
  cursorUp: function(){   
    this.set('focused', this.up(this.get('focused')));  
  },
  down: function(fromNode){

    // if child nodes, move to first one
    if(fromNode.get('nodes').length > 0){
      return fromNode.get('nodes').first();
    }

    var collection = fromNode.get('collection');

    if (!collection.node && fromNode.cid === collection.last().cid){
      // end of outline
      return fromNode;
    }
    
    var node = fromNode;
    // at end of branch - go to parent's next sibling
    while(node && node.cid === node.get('collection').last().cid){
      node = node.get('collection').node;
    }

    // go to node's next sibling
    var found = false;
    var target = node;
    node.get('collection').find(function(x, i){
      if(found){
        target = x;
        return true;
      }
      if(x.cid === node.cid){
        found = true;
      }
      return false;
    });   

    return (!!target) ? target : node;

  },
  cursorDown: function(){
    this.set('focused', this.down(this.get('focused')));  
    return;
    if(this.focusIndex() + 1 === collection.length){
      // at end of this collection
      // go to parent's next sibling

      // collection.node is parent of this collection
      focused = collection.node;
      if(!focused){
        // end of outline
        return false;
      }
      collection = focused.get('collection');
    }
    
    var found = false;
    collection.find(function(x, i){
      if(found){
        self.set('focused', x);
        return true;
      }

      if(x.cid === focused.cid){
        found = true;
      }
      return false;
    });   
  },

});

// views

App.Views.Outline = Backbone.View.extend({
  className: 'outline',
  template: _.template('\
<h3><%= title %></h3>\
<div class="nodes"></div>\
'),
  view: false,
  initialize : function(opts) {
    this.model = opts.model;
    this.delegateEvents();
    _.bindAll(this, 'render');
    this.model.on('change', this.render);
    this.render();
  },
  onClose: function(){
    this.stopListening();
    this.view.close();
  },
  events: {
  },
  render: function() {
    var self = this;

    if(this.view){
      this.view.close();
    }

    $(this.el).html(this.template(this.model.toJSON()));

    this.view = new App.Views.Nodes({
      el: this.$('.nodes'),
      collection: this.model.get('nodes')
    });

  }
});


App.Views.Nodes = Backbone.View.extend({
  className: 'nodes',
  views: [],
  initialize : function(opts) {
    this.collection = opts.collection
    this.delegateEvents();
    _.bindAll(this, 'render');
    this.render();
    this.collection.on('add', this.render);
  },
  onClose: function(){
    this.stopListening();
    _.each(this.views, function(x){
      x.close();
    });
  },
  events: {
  },
  render: function() {
    var self = this;

    _.each(this.views, function(x){
      x.close();
    });

    this.views = [];

    this.collection.each(function(node){
      var el = $('<div class="node" />')
        .appendTo(self.el);
      var v = new App.Views.Node({
        el: el,
        model: node,
        collection: self.collection
      });
      self.views.push(v);
    });
    
  }
});


App.Views.Node = Backbone.View.extend({
  className: 'node',
  outline: false, //for child nodes
  template: _.template('\
<div class="text" contenteditable="true"><%= text %></div>\
<div class="nodes"></div>\
'),
  initialize : function(opts) {
    var self = this;
    // keep a reference to the collection this node belongs to
    this.collection = opts.collection;
    this.delegateEvents();
    _.bindAll(this, 'render','toEnd','focus','blur','onKeydown');
    this.render();
  },
  onClose: function(){
    this.stopListening();
    _.each(this.views, function(x){
      x.close();
    });
  },
  events:{
    'click .text': 'focus',
    'keydown .text': 'onKeydown',
    'blur .text': 'blur',
  },
  focus: function(){
    this.model.get('outline').focus(this.model);
  },
  blur: function(e){
    var s = this.$('.text:first').text();
    this.model.set({'text': s});
  },
  shift: false,
  control: false,
  onKeydown: function(e){
    switch(e.which){

    case 16:
      this.shift = true;
      break;

    case 17:
      this.control = true;
      break;

    case 8:
      // backspace
      if(this.control){
        e.preventDefault();
        e.stopPropagation();
        this.model.get('outline').deleteNode();
        return;
      }
      var s = this.$('.text:first').text();
      if(s.length === 0){
        e.preventDefault();
        e.stopPropagation();
        this.model.get('outline').deleteNode();
      }
      break;

    case 46:
      // delete
      if(this.control){
        e.preventDefault();
        e.stopPropagation();
        this.model.get('outline').deleteNextNode();
        return;
      }
      var s = this.$('.text:first').text();
      if(s.length === 0){
        e.preventDefault();
        e.stopPropagation();
        this.model.get('outline').deleteNextNode();
      }
      break;

    case 9:
      // tab
      e.preventDefault();
      if(this.shift){
        this.model.get('outline').promote();
      } else {
        this.model.get('outline').demote();
      }
      break;

    case 13:
      // enter
      e.preventDefault();
      this.model.set({
        'text': this.$('.text:first').text()
      });
      this.model.get('outline').addNode();
      break;
    case 27:
      // esc
      e.preventDefault();
      e.stopPropagation();
      this.render();
      break;


    case 38:
      // up;
      e.preventDefault();
      var s = this.$('.text:first').text();
      this.model.set({'text': s});
      this.model.get('outline').cursorUp();
      break;

    case 40:
      // down
      e.preventDefault();
      var s = this.$('.text:first').text();
      this.model.set({'text': s});
      this.model.get('outline').cursorDown();
      break;
    }
  },
  toEnd: function(){
    var el = this.$('.text:first')[0];
    var range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  },
  render: function() {
    var self = this;

    if(this.outline){
      this.outline.close();
      this.outline = false;
    }
    //var data = this.model.toJSON();
    var data = {text: this.model.cid};
    $(this.el).html(this.template(data));

    // if(this.model.get('selected')){
    //   $(this.el).addClass('selected');
    // }

    if(this.model.get('outline').get('focused').cid == this.model.cid){
      $(this.el).addClass('focused');
      this.$('.text').focus();
      this.toEnd();
    }

    if(this.model.get('nodes').length > 0){
      this.outline = new App.Views.Nodes({
        el: this.$('.nodes'),
        collection: this.model.get('nodes')
      });
    }

  }
});

