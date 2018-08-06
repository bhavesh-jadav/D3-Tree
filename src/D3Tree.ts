import { SVGUtils } from './Utils';
import { linkHorizontal, linkVertical } from 'd3-shape'
import { Selection, select, BaseType, event } from 'd3-selection'
import { tree, hierarchy, TreeLayout, HierarchyPointNode, cluster, HierarchyPointLink, HierarchyNode} from 'd3-hierarchy'
import { zoom, zoomIdentity } from 'd3-zoom'
import { max } from 'd3-array';
import * as d3_ease from 'd3-ease';
import 'd3-transition'

//svgutils
let Translate = SVGUtils.Translate;

export class D3Tree {

    private nodeUID: number = 0; // Used to uniquely identify nodes in tree and it will be used by d3 data joins for enter, update and exit
    private treeGroup: Selection<BaseType, any, any, any>; // Holds the parent group element of the tree.
    private treeMap: TreeLayout<any>; // Holds defination of funtion to create tree layout based on given tree type, size and hierarhcy data.
    private hierarchyData: HierarchyNode<any>; // Holds hierarchy data which gives information such as depth and height of the nodes and other info.
    private treeData: HierarchyPointNode<any>; // Holds tree data created from treeMap and hierarchyData with info such as x and y coordinate of the node.
    private treeDataArray: HierarchyPointNode<any>[]; // Holds nodes in form of array in chronological order from top to bottom.
    private treeDataLinks: HierarchyPointLink<any>[]; // Holds defination of links between nodes.
    private enableZoom: boolean = false; // enable zoom when there is no treeheight and width is provided.
    private maxExpandedDepth: number;

    /**
     * 
     * @param rootSVG Root SVG element where tree will be created
     * @param data JSON Data in form of tree structure
     * @param treeProperties TreeProperties object that specifies different properties and settings of the tree.
     */
    constructor (private rootSVG: Selection<BaseType, any, any, any>, private data: any, private treeProperties: TreeProperties) { }

    /**
     * Call this funtion wich will create initial tree structure based on generalProperties specified in
     * treeProperties in constructor
     */
    CreateTree() {
        let generalProperties:TreeGeneralProperties = this.treeProperties.generalProperties;

        // set maxExpandedDepth to defaultMaxDepth
        this.maxExpandedDepth = generalProperties.defaultMaxDepth;

        // Generate hierarchy data which gives depth, height and other info.
        this.hierarchyData = hierarchy(this.data, (d: any) => {
            return d.children;
        });

        /**
         * Recursive funtion used to collapse tree nodes based on defaultMaxDepth property of generalSettings.
         * @param d tree node
         */
        let collapseNodes = (d: any) => {
            if(d.children && d.depth >= generalProperties.defaultMaxDepth) {
                d._children = d.children
                d._children.forEach(collapseNodes);
                d.children = null
            }
        }
        this.hierarchyData.each(collapseNodes); // collapse tree nodes based on DefaultMaxDepth

        // add parent group for tree to rootSVG element.
        this.treeGroup = this.rootSVG
            .append('g')
            .classed('treeGroup', true);

        // only add zoom when no fixed treeheight and treewidth is provided.
        if (generalProperties.treeHeight == undefined && generalProperties.treeWidth == undefined) {
            this.enableZoom = true;
        }

        // create tree data based on give data
        // this._createTreeData();

        

        this._updateTree();
    }

    /**
     * Updates the tree such as updating nodes, nodes shapes, node links etc.
     */
    private _updateTree() {
        this._createTreeData();
        this._createNodes();
        // this._createNodeShape();
        // this._createNodeLinks();
        // this._createNodeText();
    }

    /**
     * Creates D3 tree data based on json data provided in constructor
     */
    private _createTreeData() {

        let generalProperties:TreeGeneralProperties = this.treeProperties.generalProperties;

        // if zoom is enabled that means no treeheight or treewidth is provided
        // than we calculate it according to the tree data.
        if (this.enableZoom) {
            
            // Find depth wise max children count to calculate proper tree height.
            // base code credit: http://bl.ocks.org/robschmuecker/7880033
            let depthWiseChildrenCount: number[] = [1];
            let countDepthwiseChildren = (level: number, node: any) => {
                if (node.children && node.children.length > 0 && level < this.maxExpandedDepth) {
                    if (depthWiseChildrenCount.length <= level + 1) depthWiseChildrenCount.push(0);
                    depthWiseChildrenCount[level + 1] += node.children.length;
                    node.children.forEach((d) => {
                        countDepthwiseChildren(level + 1, d);
                    });
                }
            };
            countDepthwiseChildren(0, this.hierarchyData);

            // Find longest text present in tree calculate proper spacing between nodes.
            let maxTextLabelLength = 0;
            let findMaxLabelLength = (level: number, node: any) => {
                if (node.children && node.children.length > 0 && level < this.maxExpandedDepth) {
                    if (level < generalProperties.defaultMaxDepth) {
                        node.children.forEach((element) => {
                            findMaxLabelLength(level + 1, element);
                        });
                    }
                }
                maxTextLabelLength = Math.max(node.data.name.length, maxTextLabelLength);
            };
            findMaxLabelLength(0, this.hierarchyData);

            let treeHeight = max(depthWiseChildrenCount) * 35;
            //TODO: change tree width based on actual width in px of label with max length.
            let treeWidth = maxTextLabelLength * depthWiseChildrenCount.length * 10;

            // create tree data with calculated height and width
            generalProperties.treeHeight = treeHeight;
            generalProperties.treeWidth = treeWidth;

            // adding zoom to tree.
            let minZoomScale = Math.min(
                generalProperties.containerHeight / generalProperties.treeHeight,
                generalProperties.containerWidth / generalProperties.treeWidth
            );
            // zoom will chnage transform of group element which is child of root SVG and parent of tree
            let treeGroupZoomAction = (d, i, elements) => {
                select(elements[i]).select('.treeGroup').attr('transform', event.transform);
            }
            // listner will be attached to root SVG.
            let rootSVGZoomHandler = zoom().scaleExtent([minZoomScale - (minZoomScale * 0.05), 3])
                .on('zoom', treeGroupZoomAction)
                .filter(function(){
                    return (
                        (event as MouseEvent).button == 1 ||
                        event instanceof WheelEvent
                    );
                });
            this.rootSVG.call(rootSVGZoomHandler);
        }

        if (generalProperties.isClusterLayout) {
            this.treeMap =  cluster().size([generalProperties.treeHeight, generalProperties.treeWidth]);
        } else {
            this.treeMap =  tree().size([generalProperties.treeHeight, generalProperties.treeWidth]);
        }

        // get final data
        this.treeData = this.treeMap(this.hierarchyData);
        this.treeDataArray = this.treeData.descendants();
        this.treeDataLinks = this.treeData.links();

    }

    private _createNodes() {
        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;
        let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeShapeProperties;

        let nodes = this.treeGroup.selectAll('g.node')
        .data(this.treeDataArray, (d: any) => {
            return (d.id || (d.id = ++this.nodeUID));
        });

        let nodeEnter = nodes.enter()
            .append('g')
            .classed('node', true)
            .attr('transform', (d: HierarchyPointNode<any>) => {
                if (generalProperties.orientaion == TreeOrientation.horizontal) {
                    return Translate(d.y, d.x);
                } else {
                    return Translate(d.x, d.y);
                }
            });

        let nodeUpdate = nodeEnter.merge(nodes);

        nodeUpdate.transition()
        .duration(1000)
        .attr('transform', (d: HierarchyPointNode<any>) => {
            if (generalProperties.orientaion == TreeOrientation.horizontal) {
                return Translate(d.y, d.x);
            } else {
                return Translate(d.x, d.y);
            }
        })

        let nodeExit = nodes.exit()
            .attr('opacity', 1)
            .transition()
            .duration(1500)
            .ease(d3_ease.easeCubicOut)
            .attr('opacity', 0)
            .remove();


        if (nodeShapeProperties.shapeType == TreeNodeShapeTypes.circle) {
            nodeEnter.append('circle')
                .attr('r', nodeShapeProperties.size)
                .attr('fill', nodeShapeProperties.fill)
                .attr('stroke', nodeShapeProperties.stroke);
        } else if (nodeShapeProperties.shapeType == TreeNodeShapeTypes.square) {
            nodeEnter.append('rect')
                .attr('transform', (d: any) => {
                    let diff = 0 - nodeShapeProperties.size / 2;
                    return Translate(diff, diff);
                })
                .attr('height', nodeShapeProperties.size)
                .attr('width', nodeShapeProperties.size)
                .attr('fill', nodeShapeProperties.fill)
                .attr('stroke', nodeShapeProperties.stroke);
        }

        let click = (d: any) => {
            if (d.children) {
                d._children = d.children;
                d.children = null;
                this.maxExpandedDepth = d.depth;
            } else {
                d.children = d._children;
                d._children = null;
                this.maxExpandedDepth = d.depth + 1;
            }
            this._updateTree();
        }

        nodeEnter.on('click', click);

        if (nodeShapeProperties.animation) {
            nodeEnter.attr('opacity', 0)
                .transition()
                .duration(1500)
                .ease(d3_ease.easeCubicOut)
                .attr('opacity', 1);
        }

        nodeEnter.append('title')
            .text((d: any) => {
                return d.data.name;
            });

        // console.log(node);
        // console.log(this.treeDataArray);

    }

    // private _createNodeShape() {

    //     let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeShapeProperties;

    //     let nodeShapeEnter: d3.Selection<d3.BaseType, any, any, any>;
    //     let node = this.treeGroup.selectAll('g.node')
    //         // .data(this.treeDataArray, (d: any) => {
    //         //     return (d.id);
    //         // });

    //     console.log(node);

    //     if (nodeShapeProperties.shapeType == TreeNodeShapeTypes.circle) {
    //         nodeShapeEnter = node.append('circle')
    //             .attr('r', nodeShapeProperties.size)
    //             .attr('fill', nodeShapeProperties.fill)
    //             .attr('stroke', nodeShapeProperties.stroke);
    //     } else if (nodeShapeProperties.shapeType == TreeNodeShapeTypes.square) {
    //         nodeShapeEnter = node.append('rect')
    //             .attr('transform', (d: any) => {
    //                 let diff = 0 - nodeShapeProperties.size / 2;
    //                 return Translate(diff, diff);
    //             })
    //             .attr('height', nodeShapeProperties.size)
    //             .attr('width', nodeShapeProperties.size)
    //             .attr('fill', nodeShapeProperties.fill)
    //             .attr('stroke', nodeShapeProperties.stroke);
    //     }

    //     let click = (d: any) => {
    //         if (d.children) {
    //             d._children = d.children;
    //             d.children = null;
    //         } else {
    //             d.children = d._children;
    //             d._children = null;
    //         }
    //         this._updateTree();
    //     }

    //     nodeShapeEnter.on('click', click);

    //     if (nodeShapeProperties.animation) {
    //         nodeShapeEnter.attr('opacity', 0)
    //             .transition()
    //             .duration(1500)
    //             .ease(d3_ease.easeCubicOut)
    //             .attr('opacity', 1);
    //     }

    //     nodeShapeEnter.append('title')
    //         .text((d: any) => {
    //             return d.data.name;
    //         });
    //     this._updateTreeGroupTransform(nodeShapeProperties.size + 5, 0);

    // }

    private _createNodeLinks() {

        let nodeLinkProperties: TreeNodeLinkProperties = this.treeProperties.nodeLinkProperties;
        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;

        let horizontalCurveLink = linkHorizontal()
            .x(function(d: any) { return d.y; })
            .y(function(d: any) { return d.x; });
        let verticalCurveLink = linkVertical()
            .x(function(d: any) { return d.x; })
            .y(function(d: any) { return d.y; });

        let horizontalStraightLink = (source: any, target: any) => {
            return "M" + source.y + "," + source.x +
                "L" + target.y + "," + target.x;
        }
        let verticalStraightLink = (source: any, target: any) => {
            return "M" + source.x + "," + source.y +
                "L" + target.x + "," + target.y;
        }

        let horizontalSquareLink = (source: any, target: any) => {
            return "M" + source.y + "," + source.x +
                "H" + (source.y + 15) +  // change +15
                "V" + target.x +
                "H" + target.y;
        }
        let verticalSquareLink = (source: any, target: any) => {
            return "M" + source.x + "," + source.y +
                "H" + target.x +
                "V" + target.y;
        }

        let links: d3.Selection<d3.BaseType, any, any, any> = this.treeGroup.selectAll('path.link')
            .data(this.treeDataLinks)
            .enter()
            .insert("g", "g")   //will insert path before g elements
            .classed('link', true);

        links.append('path')
            .attr('fill', 'none')
            .attr('stroke', nodeLinkProperties.stroke)
            .attr('stroke-width', nodeLinkProperties.strokeWidth)
            .attr('d', (d: any) => {
                if (nodeLinkProperties.treeNodeLinkType == TreeNodeLinkTypes.curved) {
                    if (generalProperties.orientaion == TreeOrientation.horizontal) {
                        return horizontalCurveLink(d) as any
                    } else {
                        return verticalCurveLink(d) as any
                    }
                } else if (nodeLinkProperties.treeNodeLinkType == TreeNodeLinkTypes.straight) {
                    if (generalProperties.orientaion == TreeOrientation.horizontal) {
                        return horizontalStraightLink(d.source, d.target);
                    } else {
                        return verticalStraightLink(d.source, d.target);
                    }
                } else if (nodeLinkProperties.treeNodeLinkType == TreeNodeLinkTypes.corner) {
                    if (generalProperties.orientaion == TreeOrientation.horizontal) {
                        return horizontalSquareLink(d.source, d.target);
                    } else {
                        return verticalSquareLink(d.source, d.target);
                    }
                }
            });

        if (nodeLinkProperties.animation) {
            links.selectAll('path').each((d, i, elements) => {
                let linkLength = (elements[i] as any).getTotalLength();
                select(elements[i])
                    .attr('stroke-dasharray', linkLength + " " + linkLength)
                    .attr("stroke-dashoffset", linkLength)
                    .transition()
                    .duration(1000)
                    .ease(d3_ease.easeCubicIn)
                    .attr("stroke-dashoffset", 0);
            });
        }

        links.append('title')
            .text((d: any) => {
                return d.source.data.name + " -> " + d.target.data.name;
            });
    }

    private _createNodeText() {

        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;

        if (generalProperties.orientaion == TreeOrientation.vertical) {
            this._createNodeTextVertical();
        } else {
            this._createNodeTextHorizontal();
        }
    }

    private _createNodeTextVertical() {

        let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeShapeProperties;
        let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeTextProperties;

        let nodeTexts = this.treeGroup.selectAll('text.nodeText')
            .data(this.treeDataArray)
            .enter()
            .append('g')
            .attr('transform', (d:any) => {
                return Translate(d.x + nodeShapeProperties.size + 8, d.y)
            });

        nodeTexts.append('text')
            .attr('fill', nodeTextProperties.foregroundColor)
            .style('dominant-baseline', 'central')
            .text((d: any) => {
                return d.data.name;
            });

        nodeTexts.style('text-anchor', (d: any, i, elements) => {
            let textWidth: number = (elements[i] as any).getBBox().width;
            let textAnchor = (textWidth < nodeShapeProperties.size) ? 'middle' : 'start';
            return textAnchor;
        });

        nodeTexts.append('title')
            .text((d: any) => {
                return d.data.name;
            });

        if (nodeTextProperties.enableBackground) {
            nodeTexts.insert('rect', 'text')
            .each((d, i, elements) => {
                let svgRect: SVGRect = (elements[i] as any).parentNode.getBBox();
                select(elements[i])
                    .attr('x', svgRect.x - 2)
                    .attr('y', svgRect.y - 2)
                    .attr('height', svgRect.height + 4)
                    .attr('width', svgRect.width + 4)
                    .attr('fill', nodeTextProperties.backgroundColor ? nodeTextProperties.backgroundColor : '#F2F2F2');
            });
        }
    }

    private _createNodeTextHorizontal() {

        let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeShapeProperties;
        let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeTextProperties;

        let nodeTexts = this.treeGroup.selectAll('text.nodeText')
            .data(this.treeDataArray)
            .enter()
            .append('g')
            .attr('transform', (d:any) => {
                let translate = d.children ? Translate(d.y - nodeShapeProperties.size - 8, d.x) :
                    Translate(d.y + nodeShapeProperties.size + 8, d.x);
                return translate;
            });

        nodeTexts.append('text')
            .attr('fill', nodeTextProperties.foregroundColor)
            .style('dominant-baseline', 'central')
            .text((d: any) => {
                return d.data.name;
            });

        nodeTexts.style('text-anchor', (d: any, i, elements) => {
                let textAnchor = d.children ? 'end': 'start';
                return textAnchor;
            });

        nodeTexts.append('title')
            .text((d: any) => {
                return d.data.name;
            });

        if (nodeTextProperties.enableBackground) {
            nodeTexts.insert('rect', 'text')
            .each((d, i, elements) => {
                let svgRect: SVGRect = (elements[i] as any).parentNode.getBBox();
                select(elements[i])
                    .attr('x', svgRect.x - 2)
                    .attr('y', svgRect.y - 2)
                    .attr('height', svgRect.height + 4)
                    .attr('width', svgRect.width + 4)
                    .attr('fill', nodeTextProperties.backgroundColor ? nodeTextProperties.backgroundColor : '#F2F2F2');
            });
        }
    }

    private _updateRootSVGSize(height: number, width: number) {
        this.rootSVG.style('height', height + "px")
            .style('width', width + "px");
    }

    private _updateTreeGroupTransform(x: number, y: number) {
        this.treeGroup.attr('transform', Translate(x, y));
    }
}

//interfaces
export interface TreeNodeShapeProperties {
    'shapeType': TreeNodeShapeTypes,
    'fill': string,
    'stroke': string,
    'size': number,
    'strokeWidth': number,
    'animation': boolean
}

export interface TreeNodeLinkProperties {
    'treeNodeLinkType': TreeNodeLinkTypes
    'stroke': string,
    'strokeWidth': number,
    'animation': boolean
}

export interface TreeNodeTextProperties {
    'fontFamily': string,
    'fontSize': string,
    'foregroundColor': string,
    'fontWeight'?: string | number,
    'fontStyle'?: string,
    'enableBackground'?: boolean,
    'backgroundColor'?: string
}

export interface TreeGeneralProperties {
    'orientaion': TreeOrientation,
    'defaultMaxDepth': number,
    'containerHeight': number,
    'containerWidth': number,
    'treeHeight'?: number,
    'treeWidth'?: number,
    'isClusterLayout'?: boolean
}

export interface TreeProperties {
    generalProperties: TreeGeneralProperties,
    nodeShapeProperties: TreeNodeShapeProperties,
    nodeLinkProperties: TreeNodeLinkProperties,
    nodeTextProperties: TreeNodeTextProperties
}

//enums
export enum TreeNodeShapeTypes {
    circle = 'circle',
    square = 'square'
}

export enum TreeNodeLinkTypes {
    straight = 'straight',
    curved = 'curved',
    corner = 'corner'
}

export enum TreeOrientation {
    horizontal = 'horizontal',
    vertical = 'vertical'
}