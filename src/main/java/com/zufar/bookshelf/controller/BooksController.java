package com.zufar.bookshelf.controller;

import com.zufar.bookshelf.entity.Book;
import com.zufar.bookshelf.service.AuthorService;
import com.zufar.bookshelf.service.BookService;
import com.zufar.bookshelf.service.CountryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.ModelMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;

@Controller
public class BooksController {

    private final BookService bookService;
    private final AuthorService authorService;
    private final CountryService countryService;

    @Autowired
    public BooksController(
            BookService bookService,
            AuthorService authorService,
            CountryService countryService
    ) {
        this.bookService = bookService;
        this.authorService = authorService;
        this.countryService = countryService;
    }

    @GetMapping("/books")
    public String getBooks(ModelMap modelMap) {
        modelMap.addAttribute("books", bookService.getAll());
        return "lists/bookListView";
    }

    @GetMapping("/book/{id}")
    public String getBook(@PathVariable(value = "id") long id, ModelMap modelMap) {
        modelMap.addAttribute("book", bookService.get(id));
        return "profiles/bookProfileView";
    }

    @GetMapping("/getAddBookView")
    public String getAddBookView(ModelMap modelMap) {
        modelMap.addAttribute("book", new Book());
        modelMap.addAttribute("authors", authorService.getAll());
        modelMap.addAttribute("countries", countryService.getAll());
        return "crud/addBookView";
    }

    @PostMapping("/addBook")
    public String addBook(Book book, ModelMap modelMap) {
        bookService.save(book);
        modelMap.addAttribute("books", bookService.getAll());
        return "lists/bookListView";
    }

    @GetMapping("/updateBookView/{id}")
    public String getUpdateBookView(@PathVariable(value = "id") long id, ModelMap modelMap) {
        modelMap.addAttribute("book", bookService.get(id));
        modelMap.addAttribute("authors", authorService.getAll());
        modelMap.addAttribute("countries", countryService.getAll());
        return "crud/updateBookView";
    }

    @PostMapping("/updateBook")
    public String updateBook(Book book, ModelMap modelMap) {
        bookService.update(book);
        modelMap.addAttribute("books", bookService.getAll());
        return "lists/bookListView";
    }

    @GetMapping("/deleteBook/{id}")
    public String deleteBook(@PathVariable(value = "id") long id, ModelMap modelMap) {
        bookService.delete(id);
        modelMap.addAttribute("books", bookService.getAll());
        return "lists/bookListView";
    }
}
