#!/usr/bin/env node
/**
 * Generate a static TVBox/OKTV-compatible config.
 *
 * The old CatVodOpen NodeJS packaging path has been removed. For the current
 * OK影视/FongMi/影视仓 workflow, prefer running proxy/ and using its root URL as the
 * configuration address. This script is kept only for simple static TVBox config
 * exports from legacy Spider files that expose getName/getJSName/getType methods.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function strToBool(value) {
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).trim().toLowerCase());
}

function parseArgs(argv) {
  const args = {
    key: '',
    aliToken: '',
    is_18: 'False',
    biliCookie: '',
    quarkCookie: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;

    const [rawKey, inlineValue] = arg.slice(2).split('=', 2);
    if (!(rawKey in args)) continue;

    if (inlineValue !== undefined) {
      args[rawKey] = inlineValue;
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      args[rawKey] = argv[i + 1];
      i += 1;
    } else {
      args[rawKey] = 'true';
    }
  }

  return args;
}

class JSModule {
  constructor(jsFile, jsString) {
    this.jsFile = jsFile;
    this.jsName = path.basename(jsFile, '.js');
    this.jsString = jsString;
    this.is18 = jsString.includes('🔞');
  }

  stringReturnAfter(methodName) {
    const afterMethod = this.jsString.split(methodName).at(-1);
    if (!afterMethod || afterMethod === this.jsString) return null;

    const body = afterMethod.split('}')[0] ?? '';
    const afterReturn = body.split('return').at(-1) ?? '';
    const match = afterReturn.match(/["']([^"']+)["']/);
    return match?.[1] ?? null;
  }

  getName() {
    return this.stringReturnAfter('getName()');
  }

  getAppName() {
    return this.stringReturnAfter('getAppName()');
  }

  getJSName() {
    return this.stringReturnAfter('getJSName()');
  }

  getType() {
    const afterMethod = this.jsString.split('getType()').at(-1);
    if (!afterMethod || afterMethod === this.jsString) return null;

    const body = afterMethod.split('}')[0] ?? '';
    const afterReturn = body.split('return').at(-1) ?? '';
    const value = Number.parseInt(afterReturn.trim(), 10);
    return Number.isNaN(value) ? null : value;
  }
}

class Build {
  constructor({ channelKey, aliToken, biliCookie, quarkCookie, is18 }) {
    this.is18 = strToBool(is18);
    this.quarkCookie = quarkCookie;
    this.aliToken = aliToken;
    this.biliCookie = biliCookie;
    this.channelKey = channelKey;
  }

  async getJSFiles() {
    const names = await readdir('js');
    const modules = [];

    for (const name of names.filter((item) => item.endsWith('.js')).sort()) {
      const jsFile = path.join('js', name);
      const module = new JSModule(jsFile, await readFile(jsFile, 'utf8'));
      const jsName = module.getJSName();

      if (!module.getName() || !jsName) continue;
      if (this.channelKey && this.channelKey !== jsName) continue;
      modules.push(module);
    }

    return modules;
  }

  getBaseConfig(module, tvType = 'TVBox') {
    return {
      key: module.jsName,
      name: module.getName(),
      api: `./${module.jsFile.split(path.sep).join('/')}`,
      type: module.getType(),
      timeout: 30,
      playerType: 0,
      ext: { box: tvType },
    };
  }

  applyCustomConfig(site, module) {
    const appName = module.getAppName() ?? '';

    if (appName.includes('阿里') || appName.includes('厂长直连')) {
      site.ext.aliToken = this.aliToken;
      site.ext.quarkCookie = this.quarkCookie;
    } else if (['泥视频', '量子资源'].includes(appName)) {
      site.ext.code = Number(this.is18);
    } else if (appName === '哔哩哔哩') {
      site.ext.cookie = this.biliCookie;
    }

    return site;
  }

  async getSites(spiderType = 3) {
    const modules = await this.getJSFiles();
    const sites = [];

    for (const module of modules) {
      if (module.is18 !== this.is18 || module.getType() !== spiderType) continue;
      sites.push(this.applyCustomConfig(this.getBaseConfig(module), module));
    }

    return sites;
  }

  async build() {
    const config = JSON.parse(await readFile(path.join('json', 'TVBox.json'), 'utf8'));
    config.sites = await this.getSites(3);

    const outputPath = this.is18 ? '18_tv_config.json' : 'tv_config.json';
    await writeFile(outputPath, `${JSON.stringify(config, null, 4)}\n`, 'utf8');
    console.log(`Wrote ${outputPath}`);
  }
}

const args = parseArgs(process.argv.slice(2));

await new Build({
  channelKey: args.key,
  aliToken: args.aliToken.split(',')[0],
  biliCookie: args.biliCookie.split(',')[0],
  quarkCookie: args.quarkCookie.split(',')[0],
  is18: args.is_18,
}).build();
