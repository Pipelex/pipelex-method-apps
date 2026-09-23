# pipelex-method-apps

Templates for an app that runs [MTHDS](https://mthds.ai) methods through the [Pipelex](https://pipelex.com) API, one directory per shape and language. A template ships no method: it ships what every method needs, and one command turns a copy of it into the app for the method you have.

| Template                   | What a copy becomes                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`webapp-js/`](webapp-js/) | A Next.js 16 web app that renders each method's input form and result view from the method's own contract, and runs it through [`@pipelex/sdk`](https://www.npmjs.com/package/@pipelex/sdk) |

Looking for worked examples instead? [`pipelex-starter-js`](https://github.com/Pipelex/pipelex-starter-js) is the gallery the web app template was extracted from, with several demo methods presented as tabs.

## Start a project from a template

A project is a copy of one template directory, and nothing else from this repository. Copy the directory out of a shallow clone into a new directory, make that a repository, and run the template's create gesture with your method:

```bash
src=$(mktemp -d)
git clone --depth 1 https://github.com/Pipelex/pipelex-method-apps.git "$src"
mkdir -p my-app && cp -R "$src/webapp-js/." my-app/    # my-app/ is new or empty
cd my-app && git init

export PIPELEX_API_KEY=…                               # from app.pipelex.com
export PIPELEX_BASE_URL=https://api-dev.pipelex.com    # for now, see the template's README
make create METHOD=path/to/my_method.mthds
make dev                                               # http://127.0.0.1:4300
```

`METHOD` is a `.mthds` file or a directory of them, a method id from your organization's catalog (`mt_…`), or a published package address. The template's own [README](webapp-js/README.md) and [`docs/create.md`](webapp-js/docs/create.md) say what the gesture does and how to override what it derives.

## Working on the templates

Each template is self-contained: it has its own `Makefile`, its own `CLAUDE.md` and its own checks, and works from inside its directory exactly as it will in a project. The root carries what belongs to the family, and runs every template's gate at once:

| Target                    | Purpose                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `make install`            | Install every template's dependencies, and wire the pre-commit hook                                       |
| `make check`              | The family's own checks, then every template's `make check`                                               |
| `make test`               | The tests of the root's scripts, then every template's tests                                              |
| `make all`                | `check`, `test`, then every template's build                                                              |
| `make workflows`          | Render the root twin of every template's CI workflows — needed after editing one                          |
| `make check-family`       | Check the family's one version, the workflow twins, and the formatting of the root's own files            |
| `make use-local`          | Install each template's Pipelex packages from the workspace's checkouts                                   |
| `make use-local-form`     | Install the workspace's `mthds-form` checkout alone into every template that uses the form kernel         |
| `make use-published`      | Restore the Pipelex packages each template's lock file pins                                               |
| `make use-published-form` | Restore the `@pipelex/mthds-form` version the lock file pins, in every template that uses the form kernel |
| `make local-status`       | Say, for every template, whether each Pipelex package comes from a sibling checkout or from its registry  |

`make help` lists them all. [`docs/family.md`](docs/family.md) explains the layout: why the root twins each template's workflows, how the family carries one version, and what a new template needs to join.

## License

This project is licensed under the [MIT license](LICENSE). Runtime dependencies are distributed under their own licenses.
