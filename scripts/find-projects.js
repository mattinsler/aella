import path from 'path';
import { fdir } from 'fdir';

export function findProjects(rootDir) {
  const projects = new fdir()
    .withRelativePaths()
    .exclude((d) => d === 'node_modules' || d === 'dist' || d === '.git')
    .glob('**/project.json')
    .crawl(path.join(rootDir, 'src'))
    .sync()
    .map((f) => {
      const name = path.dirname(f);
      return {
        distDir: path.join(rootDir, 'dist', name),
        name,
        srcDir: path.join(rootDir, 'src', name),
      };
    });

  const projectsByName = projects.reduce((agg, p) => {
    agg[p.name] = p;
    return agg;
  }, {});

  return { projects, projectsByName };
}
