import * as PIXI from 'pixi.js'

interface Scene {
    getContainer():PIXI.Container
    frame(delta:number):void
    ready():void
}

type SceneMan = {
    changeScene(scene:Scene):void
}

class BaseScene implements Scene{
    container: PIXI.Container 
    
    constructor() {
        this.container = new PIXI.Container()
    }

    getContainer():PIXI.Container {
        return this.container
    }
    ready(){}
    frame(delta:number) {}
}

class Menu extends BaseScene {    
    constructor(sceneMan: SceneMan) {
        super()
        
        const gr  = new PIXI.Graphics();
        gr.beginFill(0xffffff);
        gr.drawCircle(0, 0, 30);
        gr.position.set(400,300)
        gr.endFill()
        const msg = new PIXI.Text(`START`)
        msg.position.set(-msg.width/2,-msg.height/2)
        gr.addChild(msg)
        this.container.addChild(gr)

        const msg2 = new PIXI.Text(`バーを自分で書くブロック崩し(インク切れに気をつけよう！)`)
        this.container.addChild(msg2)
        gr.interactive=true
        gr.on("click", (e)=>{
            sceneMan.changeScene(new BlockBreak(sceneMan))
        })
    }
}

type Point = {
    x:number,
    y:number,
}
function pDistance(x:number, y:number, x1:number, y1:number, x2:number, y2:number) {

    var A = x - x1;
    var B = y - y1;
    var C = x2 - x1;
    var D = y2 - y1;
  
    var dot = A * C + B * D;
    var len_sq = C * C + D * D;
    var param = -1;
    if (len_sq != 0) //in case of 0 length line
        param = dot / len_sq;
  
    var xx, yy;
  
    if (param < 0) {
      xx = x1;
      yy = y1;
    }
    else if (param > 1) {
      xx = x2;
      yy = y2;
    }
    else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
  
    var dx = x - xx;
    var dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }
function intersects(ab:Point,cd:Point,pq:Point,rs:Point) {
    var det, gamma, lambda;
    det = (cd.x - ab.x) * (rs.y - pq.y) - (rs.x - pq.x) * (cd.y - ab.y);
    if (det === 0) {
      return false;
    } else {
      lambda = ((rs.y - pq.y) * (rs.x - ab.x) + (pq.x - rs.x) * (rs.y - ab.y)) / det;
      gamma = ((ab.y - cd.y) * (rs.x - ab.x) + (cd.x - ab.x) * (rs.y - ab.y)) / det;
      return (0 <= lambda && lambda <= 1) && (0 <= gamma && gamma <= 1);
    }
  };

function pointsToPolygon(points:Point[]) : Point[] {
    var notClosing = points
    for (var i = 1; points.length > i; i++){
        for (var j = 1; i-1 > j; j++){
            if(intersects(points[i-1], points[i], points[j-1], points[j])){
                console.log(i,j)
                console.log(points[i-1], points[i], points[j-1], points[j])
                notClosing = points.slice(j,i)
                i = points.length
                break
            }
        }
    }
    if(notClosing.length > 0)
        notClosing.push(notClosing[0])
    return notClosing
}
interface Ball {
    g: PIXI.Graphics
    v: Point
}
interface Block {
    g: PIXI.Graphics
}

function blockHitBall(block:Block, ball:Ball): number|null{
    const x = block.g.x
    const y = block.g.y
    const w = block.g.width
    const h = block.g.height
    if(Math.sqrt((x+w/2-ball.g.x)*(x+w/2-ball.g.x)+(y+h/2-ball.g.y)*(y+h/2-ball.g.y)) > Math.sqrt(w*w+h*h)){
        return null
    }

    const lines = [
        [{x:x, y:y},{x:x+w, y:y}],
        [{x:x, y:y},{x:x, y:y+h}],
        [{x:x, y:y+h},{x:x+w, y:y+h}],
        [{x:x+w, y:y},{x:x+w, y:y+h}],
    ]
    
    var minDist = 9999
    var minIdx = -1
    lines.forEach((line, idx)=>{
        const d = pDistance(
            ball.g.x,ball.g.y,line[0].x,line[0].y,line[1].x,line[1].y,
            )
        if(d < minDist){
            minDist = d
            minIdx = idx
        }
    })
    if(minDist < ball.g.width/2){
        return Math.min(Math.PI*3/2 + minIdx * Math.PI/2, Math.PI*3/2 + minIdx * Math.PI/2 - Math.PI*2)
    }
    return null
}

function lineHitBall(line: Line, ball:Ball): number|null {
    for(var i = 1; line.points.length > i; i++) {
        const d = pDistance(ball.g.x, ball.g.y, line.points[i-1].x, line.points[i-1].y,line.points[i].x,line.points[i].y)
        if(ball.g.width/2 > d){
            const sti = Math.max(0, i-2)
            const eni = Math.min(line.points.length-1, i+2)
            const rad1 = Math.PI/2 + Math.atan((line.points[eni].y - line.points[sti].y)/(line.points[eni].x - line.points[sti].x))
            const rad2 = rad1 + Math.PI
            const len1 = ball.v.x * Math.cos(rad1) + ball.v.y * Math.sin(rad1)
            const len2 = ball.v.x * Math.cos(rad2) + ball.v.y * Math.sin(rad2)

            const ax = ball.v.x - len1*Math.cos(rad1)
            const ay = ball.v.y - len1*Math.sin(rad1)
            const bx = ball.v.x - len2*Math.cos(rad2)
            const by = ball.v.y - len2*Math.sin(rad2)

            if(ax*ax + ay*ay < bx*bx+by*by) {
                return rad1
            }
            return rad2
        }
    }
    return null
} 

class BlockBreak extends BaseScene {
    ball: Ball
    blocks: Block[] = []
    walls: Line[]
    sceneMan: SceneMan
    gameover: boolean = false
    dCanvas: DrawableCanvas
    point = 0

    constructor (sceneMan: SceneMan) {
        super()
        this.sceneMan = sceneMan

        this.walls = [
            {g:new PIXI.Graphics().moveTo(0,0), points:[{x:0,y:0},{x:800,y:0}]},
            {g:new PIXI.Graphics().moveTo(0,0), points:[{x:800,y:0},{x:800,y:600}]},
            {g:new PIXI.Graphics().moveTo(0,0), points:[{x:0,y:0},{x:0,y:600}]},
        ]

        const pc = new PIXI.Container()
        this.container.addChild(pc)
        pc.addChild(new PIXI.Graphics().beginFill(0,0).drawRect(0,0,800,600).endFill())
        this.dCanvas = new DrawableCanvas(pc)

        this.ball = {
            g:new PIXI.Graphics().lineStyle(2,0xffffff).drawCircle(0,0,10),
            v:{x:-2,y:-1},
        }
        this.ball.g.position.set(500,300)

        for(var i = 0; 800/40 > i; i++) {
            for(var j = 0; 200/20 > j; j++){
                const block = {
                    g: new PIXI.Graphics().lineStyle(2,0xffffff).beginFill(0xcccccc).drawRect(0,0,40,20).endFill()
                }
                block.g.position.set(i*40,j*20)
                this.blocks.push(block)
                this.container.addChild(block.g)
            }
        }

        this.container.addChild(this.ball.g)
        // this.test(1)
    }

    frame(delta:number) {
        this.dCanvas.frame(delta)
        if(this.gameover) return

        this.ball.g.x += this.ball.v.x*delta
        this.ball.g.y += this.ball.v.y*delta

        if(this.ball.g.x - this.ball.g.width/2 < 0) {
            this.ball.g.x = this.ball.g.width/2 
            this.ball.v.x *= -1
        }
        if(this.ball.g.x + this.ball.g.width/2 > 800) {
            this.ball.g.x = 800 - this.ball.g.width/2 
            this.ball.v.x *= -1
        }
        if(this.ball.g.y - this.ball.g.height/2 < 0) {
            this.ball.g.y = this.ball.g.height/2 
            this.ball.v.y *= -1
        }

        if(this.ball.g.x < -20 || this.ball.g.y < -20 || this.ball.g.x > 820 || this.ball.g.y > 620) {
            this.gameover = true

            const msg = new PIXI.Text(`GAME OVER ${this.point}点`)
            msg.position.set(400,300)
            msg.pivot.x=msg.width/2
            msg.pivot.y=msg.height/2
            this.container.addChild(msg)

            const btntxt = new PIXI.Text("メニューへ")
            const btn = new PIXI.Graphics().beginFill(0xdddddd).drawRect(0,0,btntxt.width,btntxt.height)
            btn.addChild(btntxt)
            btn.position.set(400,400)
            btn.pivot.x=msg.width/2
            btn.pivot.y=msg.height/2
            btn.interactive=true
            btn.on("click", ()=>{
                this.sceneMan.changeScene(new Menu(this.sceneMan))
            })
            this.container.interactive=true
            this.container.addChild(btn)
        }

        var rad: number|null = null
        
        for(var i = 0; this.blocks.length > i; i++) {
            const vec = blockHitBall(this.blocks[i], this.ball)
            if(vec !== null){
                rad = vec
                this.blocks[i].g.visible=false
                this.blocks.splice(i,1)
                this.ball.v.x += 0.2 * this.ball.v.x/Math.abs(this.ball.v.x)
                this.ball.v.y += 0.2 * this.ball.v.y/Math.abs(this.ball.v.y)
                this.point++
                break
            }
        }

        const lines = this.dCanvas.getLines()
        for(var i = 0; lines.length > i; i++) {
            if(lines[i].g.destroyed) continue
            const vec=lineHitBall(lines[i], this.ball)
            if(vec !== null){
                rad = vec
                break
            }
        }


        if(rad !== null){
            const len = this.ball.v.x * Math.cos(rad) + this.ball.v.y * Math.sin(rad)
            
            this.ball.v.x -= 2*len * Math.cos(rad)
            this.ball.v.y -= 2*len * Math.sin(rad)
        }
    }
}
function updateLineStyle(g: PIXI.Graphics,style: PIXI.LineStyle){   
    var len = g.geometry.graphicsData.length;    
    for (var i = 0; i < len; i++) {        
      var data = g.geometry.graphicsData[i];
      data.lineStyle = style
    }    
  }
interface Line {
    g: PIXI.Graphics
    points: Point[]
}
class DrawableCanvas {
    mouseDown: boolean = false
    container: PIXI.Container
    lines: Line[] = []
    ink: number = 800
    inkbar: PIXI.Graphics

    getInk():number{
        return this.ink
    }
    getLines():Line[] {
        return this.lines
    }

    constructor(container: PIXI.Container){
        this.container = container
        var line: Line|null = null
        
        this.inkbar = new PIXI.Graphics().lineStyle(5, 0xffffff).moveTo(0, this.container.height-5).lineTo(this.ink, this.container.height-5)
        this.container.addChild(this.inkbar)
        

        container.interactive=true
        container.addChild(
            new PIXI.Graphics().beginFill(0x8bc5ff,0.00001).drawRect(0,0, container.width,container.height).endFill()
        )
        container.on("mousedown", (e:PIXI.InteractionEvent)=>{
            this.mouseDown=true
            line = {
                points:[{x:e.data.global.x, y:e.data.global.y}],
                g: new PIXI.Graphics().lineStyle({
                    width:5,
                    color:0x00ffff, alpha:0.5,
                    join: PIXI.LINE_JOIN.ROUND,
                    cap: PIXI.LINE_CAP.ROUND,
                    miterLimit: 198,
                }).moveTo(e.data.global.x,e.data.global.y)
            }
            this.container.addChild(line.g)
        })
        this.container.on("mouseup", (e:PIXI.InteractionEvent)=>{
            if(line == null) return
            if(line.points.length > 0){
                line.g.destroy()
                line.g = new PIXI.Graphics().lineStyle({
                    width:5,
                    color:0xffffff, alpha:1,
                    join: PIXI.LINE_JOIN.ROUND,
                    cap: PIXI.LINE_CAP.ROUND,
                    miterLimit: 198,
                }).moveTo(line.points[0].x,line.points[0].y)
                this.container.addChild(line.g)
                line.points.forEach(p=>line?.g.lineTo(p.x,p.y))
                this.lines.push(line)
            }
            line = null
            this.mouseDown=false
        })
        this.container.on("mousemove", (e:PIXI.InteractionEvent)=>{
            if(line == null) return
            if(this.mouseDown){
                const from = line.points[line.points.length-1]
                const to = {x:e.data.global.x,y:e.data.global.y}
                const inkUsage = Math.sqrt((from.x-to.x)*(from.x-to.x)+(from.y-to.y)*(from.y-to.y))
                if(inkUsage > this.ink) return
                this.ink -= inkUsage
                
                line.g.moveTo(from.x, from.y)
                line.points.push(to)
                line.g.lineTo(to.x,to.y)
            }
        })
    }

    frame(delta: number) {
        this.ink = Math.min(800, this.ink+0.5)
        this.inkbar.destroy()
        this.inkbar = new PIXI.Graphics().lineStyle(5, 0xffffff).moveTo(0, this.container.height-5).lineTo(this.ink, this.container.height-5)
        this.container.addChild(this.inkbar)
        
        for(var i = 0; this.lines.length > i; i++){
            const line = this.lines[i]
            if(line.g.destroyed) return
            line.g.alpha -= 0.01
            if(line.g.alpha <= 0) {
                line.g.destroy()
                this.lines.splice(i,1)
                i--
            }
        }

    }
}

function main() {
    const app = new PIXI.Application({
        width: 800, height: 600, backgroundColor: 0x1099bb, resolution: window.devicePixelRatio || 1,
        antialias:true,
    });
    document.body.appendChild(app.view);

    const stat:{scene:Scene|null} = {scene:null}
    function fade(to: Scene) {
        if(stat.scene)
            stat.scene.getContainer().visible = false
        app.stage = to.getContainer()
        stat.scene = to
    }

    const menu = new Menu({changeScene:fade})
    fade(menu)
    app.stage = menu.getContainer()

    app.ticker.add((delta)=>stat.scene?.frame(delta));
}

main()