PV.timeline = { fps:24, duration:30, shots:[
 {id:'dev_sky',start:0,end:5,transition_in:'fade_from_black'},
 {id:'dev_storm',start:5,end:10,transition_in:'cut'},
 {id:'dev_sea',start:10,end:15,transition_in:'crossfade'},
 {id:'dev_notes',start:15,end:20,transition_in:'dip_white'},
 {id:'dev_title_light',start:20,end:25,transition_in:'dip_white'},
 {id:'dev_title_dark',start:25,end:30,transition_in:'cut'}],
 texts:[{type:'monologue',text:'四月の音楽室には、\n〈雪あらし〉が吹き荒れていた。',start:15.5,end:19.5,style:'vertical_right',reveal:2.0},
        {type:'subtitle',text:'え？　だって、今のはミスなかったじゃん',start:1,end:4},
        {type:'copy',text:'その音は、ワタシの居場所だった。',start:11,end:14.5,style:'center'},
        {type:'html',html:PV.titleHTML('light'),start:20.3,end:24.8,style:'free',x:0,y:0},
        {type:'html',html:PV.titleHTML('dark'),start:25.2,end:29.8,style:'free',x:0,y:0}]};
