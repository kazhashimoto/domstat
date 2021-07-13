const { program } = require("commander");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const debug = require("debug")("domstat");

program
  .name("domstat.js")
  .usage("[options] htmlfile ...")
  .showHelpAfterError()
  .option('-n, --sort', 'sort by count')
  .option('-r, --root <selector>', 'specify root element')
  .option('-i, --images', 'count image files')
  .option('-T, --total', 'show grand total')

program.parse(process.argv);

const options = program.opts();
if (program.args.length < 2) {
  options.total = false;
}
debug('options', options);

const statTotal = new Map();
const imagesTotal = new Map();
const Total = {
  stat: new Map(),
  images: new Map(),
  pages: program.args.length,
  elements: 0,
  subtrees: 0,
  reused: 0
};

analyzeNext();

function analyzeNext() {
  const htmlPath = program.args.shift();
  if (htmlPath) {
    console.log(`# ${htmlPath}\n#\n`);
    analyze(htmlPath);
  }
}

function analyze(file) {
  JSDOM.fromFile(file).then(dom => {
    const { document } = dom.window;
    let root = document.body;
    if (options.root) {
      root = document.querySelector(options.root);
    }
    elements = root.querySelectorAll('*');

    const stat = new Map();
    const images = new Map();
    elements.forEach(e => {
      const tag = e.localName;
      if (stat.has(tag)) {
        stat.get(tag).count++;
      } else {
        stat.set(tag, {count: 1});
      }
      if (options.images && tag == 'img') {
        const src = e.getAttribute('src');
        debug('img src=' + src);
        if (images.has(src)) {
          images.get(src).count++;
        } else {
          images.set(src, {count: 1});
        }
      }
    });
    debug('stat', stat);
    debug('images', images);

    if (options.sort) {
      sortByCount(stat);
    } else {
      sortByKey(stat);
    }
    if (options.images) {
      console.log('');
      if (options.sort) {
        sortByCount(images);
      } else {
        sortByKey(images);
      }
    }

    const children = root.childNodes;
    let count = 0;
    children.forEach(e => {
      if (e.nodeType === 1) {
        if (e.localName == 'script' || e.localName == 'iframe') {
          return;
        }
        count++;
      }
    });

    Total.elements += elements.length;
    Total.subtrees += count;

    console.log('');
    console.log('elements: ' + elements.length);
    console.log('subtrees: ' + count);
    console.log('divs / subtree : ' + Number(stat.get('div').count / count).toFixed(3));
    if (options.images && stat.get('img')) {
      const reused = stat.get('img').count - images.size;
      const ratio = Number(100 * reused / stat.get('img').count).toPrecision(4);
      console.log(`image files: ${images.size}, reused ${reused} (${ratio}%)`);
      Total.reused += reused;
    }

    accumulate(stat, Total.stat);
    accumulate(images, Total.images);
    if (program.args.length > 0) {
      console.log('\n#');
      setTimeout(analyzeNext, 10);
    } else if (options.total && Total.pages > 1) {
      showGrandTotal();
    }

  }).catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}

function sortByKey(map) {
  [...map.keys()]
    .sort((a,b) => a.localeCompare(b))
    .forEach(k => {
      console.log(k + ' ' + map.get(k).count);
    });
}

function sortByCount(map) {
  [...map].map((e,i) => {
    // e = [ key, { value }]
    e[1].idx = i;
    return e;
  });
  const keys = [...map.keys()];
  [...map.values()]
    .sort((a,b) => b.count - a.count)
    .forEach(e => {
      console.log(keys[e.idx] + ' ' + e.count);
    });
}

function accumulate(map, target) {
  [...map].forEach(item => {
    // item = [ key, { value }]
    const key = item[0];
    if (target.has(key)) {
      const value = target.get(key);
      value.count += item[1].count;
    } else {
      target.set(key, {count: item[1].count});
    }
  });
  debug('accumulate', target);
}

function showGrandTotal() {
  console.log('\n#\n# Grand Total\n#\n');
  if (options.sort) {
    sortByCount(Total.stat);
  } else {
    sortByKey(Total.stat);
  }
  if (options.images) {
    console.log('');
    if (options.sort) {
      sortByCount(Total.images);
    } else {
      sortByKey(Total.images);
    }
  }

  console.log('');
  console.log('pages: ' + Total.pages);
  console.log('elements: ' + Total.elements);
  console.log('subtrees: ' + Total.subtrees);
  console.log('divs / subtree : ' + Number(Total.stat.get('div').count / Total.subtrees).toFixed(3));
  if (options.images && Total.stat.get('img')) {
    const ratio = Number(100 * Total.reused / Total.stat.get('img').count).toPrecision(4);
    console.log(`image files: ${Total.images.size}, reused ${Total.reused} (${ratio}%)`);
  }
}
