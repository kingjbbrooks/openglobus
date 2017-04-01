goog.provide('my.LineRing');

goog.require('og.scene.RenderNode');
goog.require('og.inheritance');

goog.require('og.EntityCollection');
goog.require('og.Entity');
goog.require('og.Label');
goog.require('og.LonLat');
goog.require('og.Extent');

function getIntersection(start1, end1, start2, end2) {
    if (!start1.equal(start2)) {
        var dir = end2.sub(start2);
        var perp = new og.math.Vector2(-dir.y, dir.x);
        var d2 = perp.dot(start2);
        var seg = perp.dot(start1) - d2;
        var u = seg / (seg - perp.dot(end1) + d2);
        return start1.add(end1.sub(start1).scale(u));
    }
    return start1;
}

function test0(order) {
    thickness = 20;
    current = og.math.vector2(100, 300), prev = og.math.vector2(700, 300), next = og.math.vector2(700, 300);
    dirNext = next.sub(current).normalize(), dirPrev = next.sub(current).normalize();
    normalNext = og.math.vector2(-dirNext.y, dirNext.x).normalize();
    normalPrev = og.math.vector2(dirPrev.y, -dirPrev.x).normalize();
    d = thickness * Math.sign(order);
    //vec2 m = getIntersection( current + normalPrev * d, prev + normalPrev * d,
    //    current + normalNext * d, next + normalNext * d );
    m = getIntersection(current.add(normalPrev.scaleTo(d)), prev.add(normalPrev.scaleTo(d)),
        current.add(normalNext.scaleTo(d)), next.add(normalNext.scaleTo(d)));

    ccw = Math.sign(dirNext.x * dirPrev.y - dirNext.y * dirPrev.x);
    if (ccw == 0.0) ccw = 1.0;
}

my.LineRing = function(name) {
    og.inheritance.base(this, name);
    this.thickness = 5;

    this._lineVertices = [];
    this._lineOrders = [];
    this._lineIndexes = [];
    this._lineThickness = [];
    this._lineColors = [];
};

og.inheritance.extend(my.LineRing, og.scene.RenderNode);

function appendLineRingData(pathArr, color, thickness, outVertices, outOrders, outIndexes, outColors, outThickness) {
    var index = 0;

    if (outIndexes.length > 0) {
        index = outIndexes[outIndexes.length - 5] + 9;
        outIndexes.push(index, index);
    }

    var t = thickness,
        c = color;

    for (var j = 0; j < pathArr.length; j++) {
        path = pathArr[j];
        var startIndex = index;
        var last = path[path.length - 1];
        var prev = last;
        outVertices.push(last[0], last[1], last[0], last[1], last[0], last[1], last[0], last[1]);
        outOrders.push(1, -1, 2, -2);

        outThickness.push(t, t, t, t);
        outColors.push(c[0], c[1], c[2], c[3], c[0], c[1], c[2], c[3], c[0], c[1], c[2], c[3], c[0], c[1], c[2], c[3]);

        for (var i = 0; i < path.length; i++) {
            var cur = path[i];
            outVertices.push(cur[0], cur[1], cur[0], cur[1], cur[0], cur[1], cur[0], cur[1]);
            outOrders.push(1, -1, 2, -2);
            outThickness.push(t, t, t, t);
            outColors.push(c[0], c[1], c[2], c[3], c[0], c[1], c[2], c[3], c[0], c[1], c[2], c[3], c[0], c[1], c[2], c[3]);
            outIndexes.push(index++, index++, index++, index++);
        }

        var first = path[0];
        outVertices.push(first[0], first[1], first[0], first[1], first[0], first[1], first[0], first[1]);
        outOrders.push(1, -1, 2, -2);
        outThickness.push(t, t, t, t);
        outColors.push(c[0], c[1], c[2], c[3], c[0], c[1], c[2], c[3], c[0], c[1], c[2], c[3], c[0], c[1], c[2], c[3]);
        outIndexes.push(startIndex, startIndex + 1, startIndex + 1, startIndex + 1);

        if (j < pathArr.length - 1) {
            index += 8;
            outIndexes.push(index, index);
        }
    }
};

my.LineRing.prototype.initialization = function() {
    this.renderer.events.on("charkeypress", og.input.KEY_X, function() {
        if (this._drawType == this.renderer.handler.gl.LINE_STRIP) {
            this._drawType = this.renderer.handler.gl.TRIANGLE_STRIP;
        } else {
            this._drawType = this.renderer.handler.gl.LINE_STRIP;
        }
    }, this);

    this._drawType = this.renderer.handler.gl.TRIANGLE_STRIP;

    this.renderer.handler.addShaderProgram(new og.shaderProgram.ShaderProgram("lineRing", {
        uniforms: {
            'viewport': {
                type: og.shaderProgram.types.VEC2
            },
            'thicknessOutline': {
                type: og.shaderProgram.types.FLOAT
            },
            'alpha': {
                type: og.shaderProgram.types.FLOAT
            },
            'extentParams': {
                type: og.shaderProgram.types.VEC4
            }
        },
        attributes: {
            'prev': {
                type: og.shaderProgram.types.VEC2
            },
            'current': {
                type: og.shaderProgram.types.VEC2
            },
            'next': {
                type: og.shaderProgram.types.VEC2
            },
            'order': {
                type: og.shaderProgram.types.FLOAT
            },
            'color': {
                type: og.shaderProgram.types.VEC4
            },
            'thickness': {
                type: og.shaderProgram.types.FLOAT
            }
        },
        vertexShader: 'attribute vec2 prev;\
                attribute vec2 current;\
                attribute vec2 next;\
                attribute float order;\
                attribute float thickness;\
                attribute vec4 color;\
                uniform float thicknessOutline;\
                uniform vec2 viewport;\
                uniform vec4 extentParams;\
                varying vec4 vColor;\
                \
                vec2 getIntersection(vec2 start1, vec2 end1, vec2 start2, vec2 end2){\
                    vec2 dir = end2 - start2;\
                    vec2 perp = vec2(-dir.y, dir.x);\
                    float d2 = dot(perp, start2);\
                    float seg = dot(perp, start1) - d2;\
                    float u = seg / (seg - dot(perp, end1) + d2);\
                    return start1 + u * (end1 - start1);\
                }\
                \
                vec2 proj(vec2 coordinates){\
                    return vec2(-1.0 + (coordinates - extentParams.xy) * extentParams.zw) * vec2(1.0, -1.0);\
                }\
                \
                void main(){\
                    vColor = color;\
                    vec2 _next = next;\
                    vec2 _prev = prev;\
                    if(prev == current){\
                        if(next == current){\
                            _next = current + vec2(1.0, 0.0);\
                            _prev = current - next;\
                        }else{\
                            _prev = current + normalize(current - next);\
                        }\
                    }\
                    if(next == current){\
                        _next = current + normalize(current - _prev);\
                    }\
                    \
                    vec2 sNext = proj(_next),\
                         sCurrent = proj(current),\
                         sPrev = proj(_prev);\
                    vec2 dirNext = normalize(sNext - sCurrent);\
                    vec2 dirPrev = normalize(sPrev - sCurrent);\
                    vec2 normalNext = normalize(vec2(-dirNext.y, dirNext.x));\
                    vec2 normalPrev = normalize(vec2(dirPrev.y, -dirPrev.x));\
                    vec2 d = (thickness + thicknessOutline) * 0.5 * sign(order) / viewport;\
                    \
                    vec2 m;\
                    float dotNP = dot(dirNext, dirPrev);\
                    if(abs(dotNP) != 1.0){\
                        m = getIntersection( sCurrent + normalPrev * d, sPrev + normalPrev * d,\
                            sCurrent + normalNext * d, sNext + normalNext * d );\
                    }else{\
                        m = sCurrent + normalPrev * d;\
                    }\
                    \
                    if( dotNP > 0.5 && dot(dirNext + dirPrev, m - sCurrent) < 0.0 ){\
                        float ccw = sign(dirNext.x * dirPrev.y - dirNext.y * dirPrev.x);\
                        float occw = order * ccw;\
                        if(occw == -1.0){\
                            m = sCurrent + normalPrev * d;\
                        }else if(occw == 1.0){\
                            m = sCurrent + normalNext * d;\
                        }else if(occw == -2.0){\
                            m = sCurrent + normalNext * d;\
                        }else if(occw == 2.0){\
                            m = sCurrent + normalPrev * d;\
                        }\
                    }else{\
                        float maxDist = max(distance(sCurrent, sNext), distance(sCurrent, sPrev));\
                        if(distance(sCurrent, m) > maxDist){\
                            m = sCurrent + maxDist * normalize(m - sCurrent);\
                        }\
                    }\
                    gl_Position = vec4(m.x, m.y, 0.0, 1.0);\
                }',
        fragmentShader: 'precision highp float;\
                uniform float alpha;\
                varying vec4 vColor;\
                void main() {\
                    gl_FragColor = vec4(vColor.rgb, alpha * vColor.a);\
                }'
    }));

    var pathArr = [
        [
            [20, 0],
            [90, 0],
            [30, 50]
        ],
        [
            [-10, -5],
            [-12, -35]
        ],
        [
            [0 - 20, -20],
            [-20 - 20, 10],
            [50, 50]
        ]
    ];

    var colors = [
        [1, 0, 0, 0.3],
        [0, 1, 0, 1],
        [1, 1, 1, 0.3]
    ];

    var thickness = [8, 4, 12];

    appendLineRingData([pathArr[2]], colors[2], thickness[2],
        this._lineVertices, this._lineOrders, this._lineIndexes, this._lineColors, this._lineThickness);

    appendLineRingData([pathArr[0], pathArr[1]], colors[0], thickness[0],
        this._lineVertices, this._lineOrders, this._lineIndexes, this._lineColors, this._lineThickness);

    var h = this.renderer.handler;
    this._lineOrdersBuffer = h.createArrayBuffer(new Float32Array(this._lineOrders), 1, this._lineOrders.length / 2);
    this._lineVerticesBuffer = h.createArrayBuffer(new Float32Array(this._lineVertices), 2, this._lineVertices.length / 2);
    this._lineIndexesBuffer = h.createElementArrayBuffer(new Uint16Array(this._lineIndexes), 1, this._lineIndexes.length);

    this._lineThicknessBuffer = h.createArrayBuffer(new Float32Array(this._lineThickness), 1, this._lineThickness.length);
    this._lineColorsBuffer = h.createArrayBuffer(new Float32Array(this._lineColors), 4, this._lineColors.length / 4);
};

my.LineRing.prototype.frame = function() {

    var rn = this;
    var r = rn.renderer;
    var sh = r.handler.shaderPrograms.lineRing;
    var p = sh._program;
    var gl = r.handler.gl,
        sha = p.attributes,
        shu = p.uniforms;

    sh.activate();

    gl.enable(gl.BLEND);
    gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    gl.uniform2fv(shu.viewport._pName, [512, 512]);

    var extent = new og.Extent(new og.LonLat(-180, -90), new og.LonLat(180, 90));
    gl.uniform4fv(shu.extentParams._pName, [extent.southWest.lon, extent.southWest.lat, 2.0 / extent.getWidth(), 2.0 / extent.getHeight()]);

    //thickness
    gl.bindBuffer(gl.ARRAY_BUFFER, this._lineThicknessBuffer);
    gl.vertexAttribPointer(sha.thickness._pName, this._lineThicknessBuffer.itemSize, gl.FLOAT, false, 0, 0);

    //color
    gl.bindBuffer(gl.ARRAY_BUFFER, this._lineColorsBuffer);
    gl.vertexAttribPointer(sha.color._pName, this._lineColorsBuffer.itemSize, gl.FLOAT, false, 0, 0);

    //vertex
    var mb = this._lineVerticesBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, mb);
    gl.vertexAttribPointer(sha.prev._pName, mb.itemSize, gl.FLOAT, false, 8, 0);
    gl.vertexAttribPointer(sha.current._pName, mb.itemSize, gl.FLOAT, false, 8, 32);
    gl.vertexAttribPointer(sha.next._pName, mb.itemSize, gl.FLOAT, false, 8, 64);

    //order
    gl.bindBuffer(gl.ARRAY_BUFFER, this._lineOrdersBuffer);
    gl.vertexAttribPointer(sha.order._pName, this._lineOrdersBuffer.itemSize, gl.FLOAT, false, 4, 0);

    //
    //Antialiase pass
    gl.uniform1f(shu.thicknessOutline._pName, 2);
    gl.uniform1f(shu.alpha._pName, 0.54);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._lineIndexesBuffer);
    gl.drawElements(this._drawType, this._lineIndexesBuffer.numItems, gl.UNSIGNED_SHORT, 0);

    //
    //Aliased pass
    gl.uniform1f(shu.thicknessOutline._pName, 1);
    gl.uniform1f(shu.alpha._pName, 1.0);
    gl.drawElements(this._drawType, this._lineIndexesBuffer.numItems, gl.UNSIGNED_SHORT, 0);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
};