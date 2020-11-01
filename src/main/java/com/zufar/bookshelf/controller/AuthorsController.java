package com.zufar.bookshelf.controller;

import com.zufar.bookshelf.dao.author.AuthorRepository;
import com.zufar.bookshelf.dao.author.model.Author;
import com.zufar.bookshelf.dao.book.BookRepository;
import com.zufar.bookshelf.dao.country.CountryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.ModelMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;

@Controller("authors")
@RequiredArgsConstructor
public class AuthorsController {

    private final AuthorRepository authorRepository;

    private final BookRepository bookRepository;

    private final CountryRepository countryRepository;

    @GetMapping("/authors")
    public String getAll(ModelMap modelMap) {
        modelMap.addAttribute("authors", authorRepository.findAll());
        return "lists/authorListView";
    }

    @GetMapping("/authors/{id}")
    public String get(@PathVariable(value = "id") long id, ModelMap modelMap) {
        modelMap.addAttribute("author", authorRepository.findById(id).get());
        return "profiles/authorProfileView";
    }

    @GetMapping("/addAuthorForm")
    public String getAddForm(ModelMap modelMap) {
        modelMap.addAttribute("author", new Author());
        modelMap.addAttribute("books", bookRepository.findAll());
        modelMap.addAttribute("countries", countryRepository.findAll());
        return "crud/addAuthorView";
    }

    @GetMapping("/updateAuthorForm/{id}")
    public String getUpdateAuthorView(@PathVariable(value = "id") long id, ModelMap modelMap) {
        modelMap.addAttribute("author", authorRepository.findById(id).get());
        modelMap.addAttribute("books", bookRepository.findAll());
        modelMap.addAttribute("countries", countryRepository.findAll());
        return "crud/updateAuthorView";
    }

    @PostMapping("/authors")
    public String add(Author author, ModelMap modelMap) {
        authorRepository.save(author);
        modelMap.addAttribute("authors", authorRepository.findAll());
        return "lists/authorListView";
    }

    @PostMapping("/authors/{id}")
    public String update(@PathVariable(value = "id") long id, Author author, ModelMap modelMap) {
        author.setId(id);
        authorRepository.save(author);
        modelMap.addAttribute("authors", authorRepository.findAll());
        return "lists/authorListView";
    }

    @PostMapping("/deleteAuthor/{id}")
    public String delete(@PathVariable(value = "id") long id, ModelMap modelMap) {
        authorRepository.deleteById(id);
        modelMap.addAttribute("authors", authorRepository.findAll());
        return "lists/authorListView";
    }
}